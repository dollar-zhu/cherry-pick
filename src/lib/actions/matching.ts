"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { dedupeRankings } from "@/lib/matching-constraints";
import { prefilter, rank, type Ranking } from "@/lib/matching";

export type FindMatchesResult =
  | { status: "ok"; count: number; rankingFailed: boolean }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Runs prefilter → rank → replace event_candidates for the given event.
 * The event must belong to the signed-in user (enforced by RLS).
 */
export async function findMatches(eventId: string): Promise<FindMatchesResult> {
  if (!z.string().uuid().safeParse(eventId).success) {
    return { status: "error", message: "Invalid event ID." };
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return { status: "error", message: "Sign in to find matches." };
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return { status: "error", message: "Sign in to find matches." };

  // RLS limits this to the signed-in owner.
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, title, topic, goal, format, partner_criteria, city, owner_id, guest_count, date_start, date_end, dates_flexible, allowed_weekdays, needs_venue, required_amenities",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { status: "error", message: "Event not found." };

  let candidates;
  try {
    candidates = await prefilter(event);
  } catch (err) {
    console.error("[findMatches prefilter]", err);
    return { status: "error", message: "Could not search the directory. Please try again." };
  }

  if (candidates.length === 0) {
    const { error } = await supabase.from("event_candidates").delete().eq("event_id", eventId);
    if (error) {
      console.error("[findMatches delete]", error);
      return { status: "error", message: "Could not save matches. Please try again." };
    }
    return { status: "empty" };
  }

  let rankings: Ranking[] = [];
  let rankingFailed = false;

  try {
    rankings = dedupeRankings(await rank(event, candidates));
    if (rankings.length === 0) throw new Error("model returned no valid rankings");
  } catch (err) {
    console.error("[findMatches rank]", err);
    rankingFailed = true;
  }

  // Every candidate passed the hard filters, so none is dropped. One the model
  // skipped is saved unranked (score null) and sorts last.
  const byId = new Map(rankings.map((r) => [r.profileId, r]));
  const rankedAt = new Date().toISOString();
  const rows = candidates.map((candidate) => {
    const r = byId.get(candidate.id);
    return {
      event_id: eventId,
      profile_id: candidate.id,
      score: r ? Math.round(r.score * 10) / 10 : null,
      reasons: r?.reasons ?? [],
      open_questions: [...candidate.open_questions, ...(r?.open_questions ?? [])],
      ranked_at: rankedAt,
    };
  });

  const { error: upsertError } = await supabase
    .from("event_candidates")
    .upsert(rows, { onConflict: "event_id,profile_id" });
  if (upsertError) {
    console.error("[findMatches upsert]", upsertError);
    return { status: "error", message: "Could not save matches. Please try again." };
  }

  const keep = rows.map((row) => row.profile_id);
  const { error: deleteError } = await supabase
    .from("event_candidates")
    .delete()
    .eq("event_id", eventId)
    .not("profile_id", "in", `(${keep.join(",")})`);
  if (deleteError) {
    console.error("[findMatches delete]", deleteError);
    return { status: "error", message: "Could not save matches. Please try again." };
  }

  return { status: "ok", count: rows.length, rankingFailed };
}
