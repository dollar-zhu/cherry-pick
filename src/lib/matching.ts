import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  cityMatches,
  formatList,
  formatWeekdays,
  matchesHardConstraints,
  type ConstraintEvent,
} from "@/lib/matching-constraints";

export type CandidateProfile = {
  id: string;
  name: string;
  city: string;
  description: string;
  audience: string;
  topics: string[];
  has_venue: boolean;
  venue_capacity: number | null;
  is_seeking_partners: boolean;
  amenities: string[] | null;
  available_weekdays: number[] | null;
  available_from: string | null;
  available_to: string | null;
};

const PROFILE_COLS =
  "id, name, city, description, audience, topics, has_venue, venue_capacity, is_seeking_partners, amenities, available_weekdays, available_from, available_to";

const MATCH_LIMIT = 50;

export type PrefilterEvent = ConstraintEvent & { owner_id: string };

/**
 * Directory prefilter. Drops the owner's profile and anyone who fails the hard
 * constraints, prefers the event city, and returns at most 50 names.
 * Throws if the directory query fails, so the caller does not treat an error
 * as an empty result and wipe saved matches.
 */
export async function prefilter(event: PrefilterEvent): Promise<CandidateProfile[]> {
  const supabase = await createClient();

  const { data: ownProfile, error: ownError } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", event.owner_id)
    .maybeSingle();
  if (ownError) throw ownError;

  let query = supabase
    .from("profiles")
    .select(PROFILE_COLS)
    .eq("is_seeking_partners", true)
    .order("name");
  if (ownProfile) query = query.neq("id", ownProfile.id);

  const { data, error } = await query;
  if (error) throw error;

  const rows = ((data as CandidateProfile[] | null) ?? []).filter((profile) =>
    matchesHardConstraints(profile, event),
  );
  const inCity = rows.filter((profile) => cityMatches(profile.city, event.city));
  return (inCity.length > 0 ? inCity : rows).slice(0, MATCH_LIMIT);
}

const rankingSchema = z.object({
  rankings: z.array(
    z.object({
      profileId: z.string(),
      score: z.number().min(0).max(10),
      reasons: z.array(z.string().min(1).max(200)).min(1).max(3),
    }),
  ),
});

export type RankEvent = {
  title: string;
  topic: string;
  goal: string;
  partner_criteria: string;
  city: string;
  guest_count: number;
  date_start: string;
  date_end: string;
};

/**
 * Asks the model to score and explain each prefiltered profile as a co-host.
 * Returns results validated against the prefilter ID set.
 * Throws on model failure / timeout (caller falls back to prefilter order).
 */
export async function rank(
  event: RankEvent,
  candidates: CandidateProfile[],
): Promise<Array<{ profileId: string; score: number; reasons: string[] }>> {
  const { object } = await generateObject({
    model: "anthropic/claude-sonnet-5",
    schema: rankingSchema,
    abortSignal: AbortSignal.timeout(20_000),
    prompt: `You are ranking candidate organizations as potential co-hosts for an event.

Event: "${event.title}"
Topic: ${event.topic}
Goal: ${event.goal}
Partner criteria: ${event.partner_criteria}
City: ${event.city}
Guests: ${event.guest_count}
When: ${event.date_start} to ${event.date_end}

Organizations that are not seeking partners, are too small for the guest count, or are unavailable on these dates have already been removed.
Score each remaining organization on a scale of 0–10 as a co-host fit, and provide 1–3 short reasons.
Only include profile IDs from the list below. Include each ID at most once. Rank the strongest fits highest.

Candidates:
${candidates
  .map(
    (p) =>
      `ID: ${p.id} | ${p.name} | ${p.city} | Audience: ${p.audience} | Topics: ${p.topics.join(", ")} | Has venue: ${p.has_venue}${p.venue_capacity ? ` (${p.venue_capacity} cap)` : ""} | Amenities: ${formatList(p.amenities)} | Available days: ${formatWeekdays(p.available_weekdays)} | Available: ${p.available_from ?? "unknown"} to ${p.available_to ?? "unknown"} | ${p.description}`,
  )
  .join("\n")}`,
  });

  const validIds = new Set(candidates.map((p) => p.id));
  return object.rankings.filter((r) => validIds.has(r.profileId));
}
