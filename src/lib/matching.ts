import { generateObject } from "ai";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
};

const PROFILE_COLS =
  "id, name, city, description, audience, topics, has_venue, venue_capacity, is_seeking_partners";

/**
 * SQL prefilter: up to 50 profiles from the directory, excluding the event
 * owner's own profile. Tries city-match first; retries without city if empty.
 */
export async function prefilter(eventId: string): Promise<CandidateProfile[]> {
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("city, owner_id")
    .eq("id", eventId)
    .maybeSingle();

  if (!event) return [];

  const { city, owner_id } = event;

  const { data: ownProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", owner_id)
    .maybeSingle();

  async function run(withCity: boolean): Promise<CandidateProfile[]> {
    let q = supabase.from("profiles").select(PROFILE_COLS).limit(50);
    if (ownProfile) q = q.neq("id", ownProfile.id);
    if (withCity) q = q.ilike("city", `%${city}%`);
    const { data } = await q;
    return (data as CandidateProfile[] | null) ?? [];
  }

  const withCity = await run(true);
  if (withCity.length > 0) return withCity;
  return run(false);
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

/**
 * Asks the model to score and explain each prefiltered profile as a co-host.
 * Returns results validated against the prefilter ID set.
 * Throws on model failure / timeout (caller falls back to prefilter order).
 */
export async function rank(
  event: {
    title: string;
    topic: string;
    goal: string;
    partner_criteria: string;
    city: string;
  },
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

Score each organization on a scale of 0–10 as a co-host fit, and provide 1–3 short reasons.
Only include profile IDs from the list below. Rank the strongest fits highest.

Candidates:
${candidates
  .map(
    (p) =>
      `ID: ${p.id} | ${p.name} | ${p.city} | Audience: ${p.audience} | Topics: ${p.topics.join(", ")} | Has venue: ${p.has_venue}${p.venue_capacity ? ` (${p.venue_capacity} cap)` : ""} | Seeking: ${p.is_seeking_partners} | ${p.description}`,
  )
  .join("\n")}`,
  });

  const validIds = new Set(candidates.map((p) => p.id));
  return object.rankings.filter((r) => validIds.has(r.profileId));
}
