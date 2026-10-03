"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prefilter, rank } from "@/lib/matching";

export type FindMatchesResult =
  | { status: "ok"; count: number; rankingFailed: boolean }
  | { status: "empty" }
  | { status: "error"; message: string };

/**
 * Runs prefilter → rank → upsert into event_candidates for the given event.
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
    .select("id, title, topic, goal, partner_criteria, city, owner_id")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return { status: "error", message: "Event not found." };

  const candidates = await prefilter(eventId);
  if (candidates.length === 0) return { status: "empty" };

  let rankings: Array<{ profileId: string; score: number; reasons: string[] }>;
  let rankingFailed = false;

  try {
    rankings = await rank(event, candidates);
    // If the model returned no valid rows, fall back rather than saving nothing.
    if (rankings.length === 0) throw new Error("model returned no valid rankings");
  } catch (err) {
    console.error("[findMatches rank]", err);
    rankingFailed = true;
    rankings = candidates.map((p) => ({ profileId: p.id, score: 0, reasons: [] }));
  }

  const rows = rankings.map((r) => ({
    event_id: eventId,
    profile_id: r.profileId,
    score: r.score,
    reasons: r.reasons,
  }));

  const { error } = await supabase
    .from("event_candidates")
    .upsert(rows, { onConflict: "event_id,profile_id" });

  if (error) {
    console.error("[findMatches upsert]", error);
    return { status: "error", message: "Could not save matches. Please try again." };
  }

  return { status: "ok", count: rankings.length, rankingFailed };
}
