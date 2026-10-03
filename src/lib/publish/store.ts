import type { SupabaseClient } from "@supabase/supabase-js";
import { intentSchema } from "../intent";
import type { PublishStore } from "./approve";
import { isOwnAsset, type Approval, type Asset, type Party } from "./package";

/**
 * Supabase implementation of PublishStore (SUP-25).
 *
 * Reads tables owned by other tickets; if their names differ, change them here only:
 *   launch_packages      (SUP-23): id, event_id, version, luma_title, luma_description,
 *                                  linkedin_copy, x_copy,
 *                                  assets jsonb [{kind, storage_path, filename, content_type}],
 *                                  storage_path under "<launch package id>/" in the launch-assets bucket
 *   cohost_charters      (SUP-21): event_id, company_org_id, community_org_id, status, organizer_email
 *   organizations        (SUP-16): id, name
 *   organization_members (SUP-26): org_id, user_id
 *   events               (SUP-8):  the event intent
 *   audit_log            (SUP-16)
 * Owns publish_approvals and publish_jobs (0005_publish_jobs.sql).
 */
const T = {
  packages: "launch_packages",
  charters: "cohost_charters",
  orgs: "organizations",
  members: "organization_members",
  events: "events",
  approvals: "publish_approvals",
  jobs: "publish_jobs",
  audit: "audit_log",
} as const;
const ASSET_BUCKET = "launch-assets";
const SIGNED_URL_SECONDS = 60 * 60; // the mail provider fetches attachments at send time
const STALE_SENDING_MS = 10 * 60 * 1000;
const UNIQUE_VIOLATION = "23505";

const assetSchema = {
  /** Valid assets under the package's own folder; anything else is dropped. */
  parse(raw: unknown, launchPackageId: string): Asset[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((a) => {
      const r = a as Record<string, unknown>;
      const kind = r.kind;
      if (
        (kind === "cover_image" || kind === "image" || kind === "document") &&
        typeof r.storage_path === "string" &&
        isOwnAsset(launchPackageId, r.storage_path) &&
        typeof r.filename === "string" &&
        typeof r.content_type === "string"
      ) {
        return [{ kind, storagePath: r.storage_path, filename: r.filename, contentType: r.content_type }];
      }
      return [];
    });
  },
};

export function createPublishStore(db: SupabaseClient): PublishStore {
  return {
    async loadContext(launchPackageId, userId) {
      const { data: pkg, error } = await db
        .from(T.packages)
        .select("id, event_id, version, luma_title, luma_description, linkedin_copy, x_copy, assets")
        .eq("id", launchPackageId)
        .maybeSingle();
      if (error) throw error;
      if (!pkg) return null;

      const [charterRes, eventRes] = await Promise.all([
        db
          .from(T.charters)
          .select("company_org_id, community_org_id, status, organizer_email")
          .eq("event_id", pkg.event_id)
          .maybeSingle(),
        db
          .from(T.events)
          .select(
            "title, topic, goal, format, city, date_start, date_end, guest_count, budget_cap_cents, currency, sales_boundary, partner_criteria",
          )
          .eq("id", pkg.event_id)
          .maybeSingle(),
      ]);
      if (charterRes.error) throw charterRes.error;
      if (eventRes.error) throw eventRes.error;
      const charter = charterRes.data;
      const intent = intentSchema.safeParse(eventRes.data);
      if (!charter || !intent.success) return null;

      const orgIds = { company: charter.company_org_id as string, community: charter.community_org_id as string };
      const [orgsRes, memberRes] = await Promise.all([
        db.from(T.orgs).select("id, name").in("id", [orgIds.company, orgIds.community]),
        db.from(T.members).select("org_id").eq("user_id", userId).in("org_id", [orgIds.company, orgIds.community]),
      ]);
      if (orgsRes.error) throw orgsRes.error;
      if (memberRes.error) throw memberRes.error;

      const memberOf = new Set((memberRes.data ?? []).map((m) => m.org_id as string));
      // Someone in neither organization does not learn the package exists.
      if (!memberOf.has(orgIds.company) && !memberOf.has(orgIds.community)) return null;
      // A member of both organizations acts for the company side.
      const userParty: Party = memberOf.has(orgIds.company) ? "company" : "community";

      const nameOf = (id: string) => (orgsRes.data ?? []).find((o) => o.id === id)?.name ?? "Co-host";
      return {
        eventId: pkg.event_id as string,
        intent: intent.data,
        content: {
          launchPackageId: pkg.id as string,
          version: Number(pkg.version),
          lumaTitle: pkg.luma_title as string,
          lumaDescription: pkg.luma_description as string,
          linkedinCopy: (pkg.linkedin_copy as string | null) ?? null,
          xCopy: (pkg.x_copy as string | null) ?? null,
          assets: assetSchema.parse(pkg.assets, pkg.id as string),
        },
        cohosts: { company: nameOf(orgIds.company), community: nameOf(orgIds.community) },
        charterLocked: charter.status === "locked",
        organizerEmail: (charter.organizer_email as string | null)?.trim().toLowerCase() ?? null,
        userParty,
      };
    },

    async recordApproval(launchPackageId, hash, party, userId) {
      const { error } = await db
        .from(T.approvals)
        .upsert(
          { launch_package_id: launchPackageId, content_hash: hash, party, approved_by: userId },
          { onConflict: "launch_package_id,content_hash,party", ignoreDuplicates: true },
        );
      if (error) throw error;
    },

    async listApprovals(launchPackageId, hash) {
      const { data, error } = await db
        .from(T.approvals)
        .select("party, approved_by, approved_at")
        .eq("launch_package_id", launchPackageId)
        .eq("content_hash", hash);
      if (error) throw error;
      return (data ?? []).map(
        (r): Approval => ({ party: r.party as Party, approvedBy: r.approved_by as string, approvedAt: r.approved_at as string }),
      );
    },

    async claimJob(launchPackageId, hash, organizerEmail) {
      const insert = await db
        .from(T.jobs)
        .insert({ launch_package_id: launchPackageId, content_hash: hash, organizer_email: organizerEmail });
      if (!insert.error) return "claimed";
      if (insert.error.code !== UNIQUE_VIOLATION) throw insert.error;

      const { data: job, error } = await db
        .from(T.jobs)
        .select("status, updated_at")
        .eq("launch_package_id", launchPackageId)
        .eq("content_hash", hash)
        .single();
      if (error) throw error;
      if (job.status === "sent") return "sent";

      const stale = Date.now() - Date.parse(job.updated_at as string) > STALE_SENDING_MS;
      if (job.status === "sending" && !stale) return "in_progress";

      // Reclaim a failed or stale job; the status/updated_at guard lets only one caller win.
      const reclaim = await db
        .from(T.jobs)
        .update({ status: "sending", organizer_email: organizerEmail, error: null, updated_at: new Date().toISOString() })
        .eq("launch_package_id", launchPackageId)
        .eq("content_hash", hash)
        .eq("status", job.status)
        .eq("updated_at", job.updated_at)
        .select("status");
      if (reclaim.error) throw reclaim.error;
      return reclaim.data?.length ? "claimed" : "in_progress";
    },

    async jobStatus(launchPackageId, hash) {
      const { data, error } = await db
        .from(T.jobs)
        .select("status")
        .eq("launch_package_id", launchPackageId)
        .eq("content_hash", hash)
        .maybeSingle();
      if (error) throw error;
      return (data?.status as "sending" | "sent" | "failed" | undefined) ?? null;
    },

    async finishJob(launchPackageId, hash, result) {
      const { error } = await db
        .from(T.jobs)
        .update({
          status: result.status,
          agentmail_message_id: result.status === "sent" ? result.agentmailMessageId : null,
          error: result.status === "failed" ? result.error : null,
          updated_at: new Date().toISOString(),
        })
        .eq("launch_package_id", launchPackageId)
        .eq("content_hash", hash);
      if (error) throw error;
    },

    async signAssets(assets) {
      return Promise.all(
        assets.map(async (asset) => {
          const { data, error } = await db.storage
            .from(ASSET_BUCKET)
            .createSignedUrl(asset.storagePath, SIGNED_URL_SECONDS, { download: asset.filename });
          if (error) throw error;
          return { asset, url: data.signedUrl };
        }),
      );
    },

    async audit({ userId, eventId, action, outcome, detail }) {
      const { error } = await db.from(T.audit).insert({
        user_id: userId,
        event_id: eventId,
        actor: "human",
        action,
        outcome,
        detail,
      });
      if (error) throw error;
    },
  };
}
