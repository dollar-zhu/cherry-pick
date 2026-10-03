import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cityIlikePattern, sameCity } from "@/lib/matching-constraints";

export type CandidateProfile = {
  id: string;
  name: string;
  city: string;
  description: string;
  audience: string;
  topics: string[];
};

const PROFILE_COLS = "id, name, city, description, audience, topics";

const MATCH_LIMIT = 50;

export type PrefilterEvent = { city: string; owner_id: string };

/**
 * Directory prefilter. Keeps profiles in the event's city, drops the owner's
 * own profile, and returns at most 50 names.
 * Throws if the directory query fails, so the caller does not treat an error
 * as an empty result and wipe saved matches.
 */
export async function prefilter(event: PrefilterEvent): Promise<CandidateProfile[]> {
  const city = event.city.trim();
  if (!city) return [];

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
    .ilike("city", cityIlikePattern(city))
    .order("name");
  if (ownProfile) query = query.neq("id", ownProfile.id);

  const { data, error } = await query;
  if (error) throw error;

  return ((data as CandidateProfile[] | null) ?? [])
    .filter((profile) => sameCity(profile.city, city))
    .slice(0, MATCH_LIMIT);
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
  format: string;
  partner_criteria: string;
  city: string;
};

/**
 * Asks the model to score how well each local profile fits the event intent.
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
    prompt: `You are ranking organizations in ${event.city} as potential co-hosts.

Score how well each organization's audience, topics, and description fit the event intent below.
Base every reason on those fields. Location is already matched.

Event: "${event.title}"
Topic: ${event.topic}
Goal: ${event.goal}
Format: ${event.format}
Partner criteria: ${event.partner_criteria}

Score each organization from 0 to 10 and give 1–3 short reasons.
Only include profile IDs from the list below. Include each ID at most once. Rank the strongest fits highest.

Candidates:
${candidates
  .map(
    (p) =>
      `ID: ${p.id} | ${p.name} | Audience: ${p.audience} | Topics: ${p.topics.join(", ")} | ${p.description}`,
  )
  .join("\n")}`,
  });

  const validIds = new Set(candidates.map((p) => p.id));
  return object.rankings.filter((r) => validIds.has(r.profileId));
}
