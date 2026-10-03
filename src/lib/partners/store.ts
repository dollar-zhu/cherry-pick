import type { SupabaseClient } from "@supabase/supabase-js";
import { intentSchema } from "../intent";
import type { PartnerStore } from "./run";

/**
 * Supabase implementation of PartnerStore.
 *
 * Table and column names below follow the SUP-16 table list (partner_candidates,
 * partner_evidence, credit_ledger, audit_log). If SUP-16 lands with different
 * names, change them here only; nothing else touches the database.
 *
 * Expected columns:
 *   credit_ledger      (user_id, amount, operation, idempotency_key unique, ref)
 *   partner_candidates (id, search_id, event_id, user_id, community_name, url,
 *                       audience_description, formats_observed text[], fit_score,
 *                       fit_reasons text[], risks text[], suggested_outreach_angle,
 *                       rank, search_queries text[])
 *   partner_evidence   (candidate_id references partner_candidates, url, title, excerpt)
 *   audit_log          (user_id, event_id, actor, action, outcome, detail jsonb)
 */
const T = {
  events: "events",
  ledger: "credit_ledger",
  candidates: "partner_candidates",
  evidence: "partner_evidence",
  audit: "audit_log",
} as const;

const UNIQUE_VIOLATION = "23505";

export function createPartnerStore(db: SupabaseClient): PartnerStore {
  async function balance(userId: string) {
    const { data, error } = await db.from(T.ledger).select("amount").eq("user_id", userId);
    if (error) throw error;
    return (data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  }

  async function refund(userId: string, searchId: string, cost: number) {
    const { error } = await db.from(T.ledger).insert({
      user_id: userId,
      amount: cost,
      operation: "partner_search_refund",
      idempotency_key: `${searchId}:refund`,
      ref: searchId,
    });
    if (error && error.code !== UNIQUE_VIOLATION) throw error;
  }

  return {
    async loadIntent(eventId, userId) {
      const { data, error } = await db
        .from(T.events)
        .select(
          "title, topic, goal, format, city, date_start, date_end, guest_count, budget_cap_cents, currency, sales_boundary, partner_criteria",
        )
        .eq("id", eventId)
        .eq("owner_id", userId)
        .maybeSingle();
      if (error) throw error;
      const parsed = intentSchema.safeParse(data);
      return parsed.success ? parsed.data : null;
    },

    creditBalance: balance,

    async loadSearch(searchId, userId) {
      const { data, error } = await db
        .from(T.candidates)
        .select(
          `id, community_name, url, audience_description, formats_observed, fit_score, fit_reasons, risks,
           suggested_outreach_angle, ${T.evidence} (url, title, excerpt)`,
        )
        .eq("search_id", searchId)
        .eq("user_id", userId)
        .order("rank");
      if (error) throw error;
      if (!data?.length) return null;
      return data.map((r) => ({
        id: r.id,
        communityName: r.community_name,
        url: r.url,
        audienceDescription: r.audience_description,
        formatsObserved: r.formats_observed ?? [],
        fitScore: r.fit_score,
        fitReasons: r.fit_reasons ?? [],
        risks: r.risks ?? [],
        suggestedOutreachAngle: r.suggested_outreach_angle,
        evidence: (r[T.evidence] as { url: string; title: string; excerpt: string }[] | null) ?? [],
      }));
    },

    async recordSearch({ searchId, eventId, userId, queries, candidates, cost }) {
      // 1. Debit first, keyed by searchId: a retry hits the unique key and reuses the first result.
      const debit = await db.from(T.ledger).insert({
        user_id: userId,
        amount: -cost,
        operation: "partner_search",
        idempotency_key: searchId,
        ref: eventId,
      });
      if (debit.error && debit.error.code !== UNIQUE_VIOLATION) throw debit.error;

      if (debit.error) {
        // An earlier attempt with this searchId already debited.
        const { count, error } = await db
          .from(T.candidates)
          .select("id", { count: "exact", head: true })
          .eq("search_id", searchId);
        if (error) throw error;
        if (count) return "already_recorded";
        const refunded = await db
          .from(T.ledger)
          .select("idempotency_key")
          .eq("idempotency_key", `${searchId}:refund`)
          .maybeSingle();
        if (refunded.error) throw refunded.error;
        if (refunded.data) throw new Error(`Search ${searchId} was refunded by an earlier attempt`);
        // Debited but never saved (crash in between): save now under the existing debit.
      } else if ((await balance(userId)) < 0) {
        // 2. A concurrent spend overdrew the balance: undo and report.
        await refund(userId, searchId, cost);
        return "insufficient_credits";
      }

      // 3. Save candidates and evidence; refund if either insert fails.
      try {
        const { data: rows, error } = await db
          .from(T.candidates)
          .insert(
            candidates.map((c, rank) => ({
              search_id: searchId,
              event_id: eventId,
              user_id: userId,
              rank,
              community_name: c.communityName,
              url: c.url,
              audience_description: c.audienceDescription,
              formats_observed: c.formatsObserved,
              fit_score: c.fitScore,
              fit_reasons: c.fitReasons,
              risks: c.risks,
              suggested_outreach_angle: c.suggestedOutreachAngle,
              search_queries: queries,
            })),
          )
          .select("id, rank");
        if (error) throw error;

        const idByRank = new Map((rows ?? []).map((r) => [r.rank as number, r.id as string]));
        const ids = candidates.map((_, rank) => idByRank.get(rank)!);

        const evidence = candidates.flatMap((c, rank) =>
          c.evidence.map((e) => ({ candidate_id: ids[rank], url: e.url, title: e.title, excerpt: e.excerpt })),
        );
        const ev = await db.from(T.evidence).insert(evidence);
        if (ev.error) throw ev.error;

        return { candidateIds: ids };
      } catch (e) {
        await db.from(T.candidates).delete().eq("search_id", searchId);
        await refund(userId, searchId, cost);
        throw e;
      }
    },

    async audit({ userId, eventId, action, outcome, detail }) {
      const { error } = await db.from(T.audit).insert({
        user_id: userId,
        event_id: eventId,
        actor: "agent",
        action,
        outcome,
        detail,
      });
      if (error) throw error;
    },
  };
}
