import type { EventIntent } from "../intent";
import type { ToolResponse } from "../tool-response";
import {
  buildLumaPackage,
  contentHash,
  MAX_ATTACHMENT_BYTES,
  PARTIES,
  sha256Hex,
  type Approval,
  type Asset,
  type LaunchContent,
  type LumaPackage,
  type Party,
} from "./package.ts";

/**
 * Publish approval gate (SUP-25). Each co-host approves the exact content
 * (identified by its hash). Only when both have approved the same hash is the
 * Luma package emailed to the organizer, exactly once.
 */

export type PublishContext = {
  eventId: string;
  intent: EventIntent;
  content: LaunchContent;
  cohosts: Record<Party, string>; // display names
  charterLocked: boolean; // SUP-21: both orgs approved the co-host charter
  organizerEmail: string | null;
  userParty: Party | null; // which co-host the caller acts for, if any
};

export type JobClaim = "claimed" | "sent" | "in_progress";

export interface PublishStore {
  /** Null if the launch package does not exist or the caller is in neither co-host org. */
  loadContext(launchPackageId: string, userId: string): Promise<PublishContext | null>;
  /** Idempotent per (launchPackageId, hash, party). */
  recordApproval(launchPackageId: string, hash: string, party: Party, userId: string): Promise<void>;
  listApprovals(launchPackageId: string, hash: string): Promise<Approval[]>;
  /**
   * One job per (launchPackageId, hash); "claimed" only for the caller that may
   * send. A failed job, or one stuck in "sending" (crash), can be claimed again;
   * the mail idempotency key keeps that from sending a second email.
   */
  claimJob(launchPackageId: string, hash: string, organizerEmail: string): Promise<JobClaim>;
  jobStatus(launchPackageId: string, hash: string): Promise<"sending" | "sent" | "failed" | null>;
  finishJob(
    launchPackageId: string,
    hash: string,
    result: { status: "sent"; agentmailMessageId: string } | { status: "failed"; error: string },
  ): Promise<void>;
  /** Current bytes of each asset, downloaded at send time. */
  fetchAssets(assets: Asset[]): Promise<{ asset: Asset; bytes: Uint8Array }[]>;
  audit(entry: {
    userId: string;
    eventId: string | null;
    action: "publish_approval" | "publish_job";
    outcome: string;
    detail: Record<string, unknown>;
  }): Promise<void>;
}

export interface PackageMailer {
  send(
    message: {
      to: string;
      subject: string;
      text: string;
      attachments: { filename: string; contentType: string; content: string }[]; // content: base64
    },
    idempotencyKey: string,
  ): Promise<{ messageId: string }>;
}

export type PublishData = {
  contentHash: string;
  approvedBy: Party[];
  waitingFor: Party[];
  sentTo?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the Launch Studio shows: the version's hash and who has approved it. */
export async function publishStatus(input: {
  launchPackageId: string;
  userId: string;
  store: PublishStore;
}): Promise<(PublishData & { userParty: Party | null; sent: boolean }) | null> {
  const ctx = await input.store.loadContext(input.launchPackageId, input.userId);
  if (!ctx) return null;
  const hash = contentHash(ctx.intent, ctx.content, ctx.cohosts, ctx.organizerEmail);
  const approvals = await input.store.listApprovals(input.launchPackageId, hash);
  const approvedBy = PARTIES.filter((p) => approvals.some((a) => a.party === p));
  return {
    contentHash: hash,
    approvedBy,
    waitingFor: PARTIES.filter((p) => !approvedBy.includes(p)),
    userParty: ctx.userParty,
    sent: (await input.store.jobStatus(input.launchPackageId, hash)) === "sent",
  };
}

export async function approvePublish(input: {
  launchPackageId: string;
  /** Hash of the version the approver reviewed; approval is refused if the content changed since. */
  expectedHash: string;
  userId: string;
  store: PublishStore;
  mailer: PackageMailer;
}): Promise<ToolResponse<PublishData>> {
  const { launchPackageId, userId, store, mailer } = input;

  const ctx = await store.loadContext(launchPackageId, userId);
  if (!ctx) {
    return { status: "failed", summary: "Launch package not found.", nextActions: ["Generate a launch package first."] };
  }
  const eventId = ctx.eventId;
  const audit = (action: "publish_approval" | "publish_job", outcome: string, detail: Record<string, unknown>) =>
    store
      .audit({ userId, eventId, action, outcome, detail: { launchPackageId, ...detail } })
      .catch((e) => console.error("[publish] audit failed", e));

  if (!ctx.userParty) {
    return {
      status: "blocked",
      summary: "Only the two co-hosts can approve publishing.",
      nextActions: ["Ask a member of either co-host organization to approve."],
    };
  }
  if (!ctx.charterLocked) {
    return {
      status: "blocked",
      summary: "The co-host charter is not locked yet.",
      nextActions: ["Both organizations approve the co-host charter, then approve publishing."],
    };
  }
  if (!ctx.organizerEmail || !EMAIL.test(ctx.organizerEmail)) {
    return {
      status: "blocked",
      summary: "No valid organizer email is set for this event.",
      nextActions: ["Set the organizer email that should receive the Luma package."],
    };
  }

  const totalBytes = ctx.content.assets.reduce((n, a) => n + a.size, 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return {
      status: "blocked",
      summary: `The launch assets total ${(totalBytes / 1e6).toFixed(1)} MB; the email limit is ${MAX_ATTACHMENT_BYTES / 1e6} MB.`,
      nextActions: ["Use smaller images or fewer documents, then approve again."],
    };
  }

  const hash = contentHash(ctx.intent, ctx.content, ctx.cohosts, ctx.organizerEmail);
  if (hash !== input.expectedHash) {
    return {
      status: "blocked",
      summary: "The launch content changed since you reviewed it. Nothing was approved.",
      nextActions: ["Review the latest version, then approve again."],
      data: { contentHash: hash, approvedBy: [], waitingFor: [...PARTIES] },
    };
  }
  await store.recordApproval(launchPackageId, hash, ctx.userParty, userId);
  await audit("publish_approval", "approved", { party: ctx.userParty, contentHash: hash, version: ctx.content.version });

  const approvals = await store.listApprovals(launchPackageId, hash);
  const approvedBy = PARTIES.filter((p) => approvals.some((a) => a.party === p));
  const waitingFor = PARTIES.filter((p) => !approvedBy.includes(p));
  const data: PublishData = { contentHash: hash, approvedBy, waitingFor };

  if (waitingFor.length > 0) {
    return {
      status: "pending_approval",
      summary: `Approved for ${ctx.cohosts[ctx.userParty]}. Waiting for ${waitingFor.map((p) => ctx.cohosts[p]).join(" and ")}.`,
      nextActions: [`${waitingFor.map((p) => ctx.cohosts[p]).join(" and ")} must approve this exact version.`],
      approvalRequired: { action: "Send the Luma package to the organizer", reason: "Both co-hosts must approve", creditCost: 0 },
      data,
    };
  }

  const claim = await store.claimJob(launchPackageId, hash, ctx.organizerEmail);
  if (claim === "sent") {
    return { status: "success", summary: "This version was already sent to the organizer.", nextActions: [], data: { ...data, sentTo: ctx.organizerEmail } };
  }
  if (claim === "in_progress") {
    return { status: "pending_approval", summary: "The package is being sent right now.", nextActions: ["Refresh in a moment."], data };
  }

  const pkg: LumaPackage = buildLumaPackage({
    intent: ctx.intent,
    content: ctx.content,
    cohosts: ctx.cohosts,
    organizerEmail: ctx.organizerEmail,
    approvals,
  });
  const assetRefs = ctx.content.assets.map((a) => a.storagePath);
  const approvalTrail = pkg.approvals;

  try {
    // Attach the verified bytes, not links: what was approved is exactly what is sent.
    const files = await store.fetchAssets(ctx.content.assets);
    for (const { asset, bytes } of files) {
      if (sha256Hex(bytes) !== asset.sha256) {
        throw new Error(`Asset ${asset.storagePath} changed after it was approved`);
      }
    }
    const { messageId } = await mailer.send(
      {
        to: ctx.organizerEmail,
        subject: `Luma-ready event package: ${pkg.event.name}`,
        text: [
          `Both co-hosts (${ctx.cohosts.company} and ${ctx.cohosts.community}) approved this event for publishing.`,
          "",
          `Event: ${pkg.event.name}`,
          `When: ${pkg.event.startAt} to ${pkg.event.endAt}`,
          `Where: ${pkg.event.city}`,
          `Capacity: ${pkg.event.capacity}`,
          "",
          "Attached: luma-event.json with every field, plus the images and documents.",
          "Nothing has been posted yet. Create the event in Luma from the attached package.",
        ].join("\n"),
        attachments: [
          {
            filename: "luma-event.json",
            contentType: "application/json",
            content: Buffer.from(JSON.stringify(pkg, null, 2)).toString("base64"),
          },
          ...files.map(({ asset, bytes }) => ({
            filename: asset.filename,
            contentType: asset.contentType,
            content: Buffer.from(bytes).toString("base64"),
          })),
        ],
      },
      `publish:${launchPackageId}:${hash}`,
    );
    await store.finishJob(launchPackageId, hash, { status: "sent", agentmailMessageId: messageId });
    await audit("publish_job", "sent", {
      contentHash: hash,
      version: ctx.content.version,
      organizerEmail: ctx.organizerEmail,
      agentmailMessageId: messageId,
      assets: assetRefs,
      approvals: approvalTrail,
    });
    return {
      status: "success",
      summary: `Sent the Luma package to ${ctx.organizerEmail}.`,
      nextActions: ["The organizer creates the event in Luma from the package."],
      data: { ...data, sentTo: ctx.organizerEmail },
    };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("[publish] send failed", e);
    await store.finishJob(launchPackageId, hash, { status: "failed", error: error.slice(0, 500) }).catch(() => {});
    await audit("publish_job", "failed", { contentHash: hash, error, assets: assetRefs, approvals: approvalTrail });
    return {
      status: "failed",
      summary: "Both co-hosts approved, but the package could not be sent.",
      nextActions: ["Approve again to retry; your approvals are kept."],
      data,
    };
  }
}
