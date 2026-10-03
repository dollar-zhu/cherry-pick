import { generateText, Output } from "ai";
import Exa from "exa-js";
import { z } from "zod";
import type { EventIntent } from "../intent";

/**
 * Co-host partner discovery (SUP-18): EventIntent → 3-5 Exa queries → web
 * results → grounded, ranked PartnerCandidates. No database or credits here;
 * see ./run.ts. Network calls are injected so the pipeline is testable.
 */

export const MIN_CANDIDATES = 5;
export const MAX_CANDIDATES = 10;
const MAX_RESULTS = 30; // bounds the extraction prompt
const MODEL = "anthropic/claude-sonnet-5";

export type WebResult = { url: string; title: string; highlights: string[] };

export type Evidence = { url: string; title: string; excerpt: string };

export const extractedCandidateSchema = z.object({
  communityName: z.string().trim().min(1).max(200),
  url: z.string().url(),
  audienceDescription: z.string().trim().min(1).max(500),
  formatsObserved: z.array(z.string().trim().min(1).max(80)).max(10),
  fitScore: z.number().int().min(0).max(100),
  fitReasons: z.array(z.string().trim().min(1).max(300)).min(1).max(5),
  risks: z.array(z.string().trim().min(1).max(300)).max(5),
  suggestedOutreachAngle: z.string().trim().min(1).max(500),
  sourceIds: z.array(z.number().int().min(0)).min(1).max(5),
});
export type ExtractedCandidate = z.infer<typeof extractedCandidateSchema>;

export type PartnerCandidate = Omit<ExtractedCandidate, "sourceIds"> & { evidence: Evidence[] };

export type SearchDeps = {
  generateQueries(intent: EventIntent): Promise<string[]>;
  search(query: string): Promise<WebResult[]>;
  extract(intent: EventIntent, results: WebResult[]): Promise<ExtractedCandidate[]>;
};

export type SearchOutcome = { queries: string[]; candidates: PartnerCandidate[] };

export async function searchCohostPartners(
  intent: EventIntent,
  deps: SearchDeps = defaultDeps(),
): Promise<SearchOutcome> {
  const queries = await deps.generateQueries(intent).then(normalizeQueries, () => []);
  const finalQueries = queries.length >= 3 ? queries : fallbackQueries(intent);

  const settled = await Promise.allSettled(finalQueries.map((q) => deps.search(q)));
  const results = dedupeResults(
    settled.flatMap((s) => (s.status === "fulfilled" ? s.value : [])),
  ).slice(0, MAX_RESULTS);
  if (settled.every((s) => s.status === "rejected")) {
    throw new Error("Web search failed for every query", {
      cause: (settled[0] as PromiseRejectedResult).reason,
    });
  }
  if (results.length === 0) return { queries: finalQueries, candidates: [] };

  const extracted = await deps.extract(intent, results);
  return { queries: finalQueries, candidates: rankCandidates(groundCandidates(extracted, results)) };
}

// ---------- pure steps (exported for tests) ----------

export function normalizeQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of queries) {
    const q = raw.trim().replace(/\s+/g, " ").slice(0, 200);
    const key = q.toLowerCase();
    if (q && !seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
  }
  return out.slice(0, 5);
}

export function fallbackQueries(intent: EventIntent): string[] {
  return normalizeQueries([
    `${intent.topic} community in ${intent.city}`,
    `${intent.topic} meetup group ${intent.city}`,
    `${intent.format} events for ${intent.topic} ${intent.city}`,
  ]);
}

/** Canonical key: lowercase host without www, path without trailing slash, no query/hash. */
export function canonicalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export function hostOf(url: string): string | null {
  return canonicalUrl(url)?.split("/")[0] ?? null;
}

export function dedupeResults(results: WebResult[]): WebResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = canonicalUrl(r.url);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Keeps only candidates backed by real search results: every cited source must
 * exist and the candidate's URL must be on the same site as one of them.
 * Evidence comes from the search results, never from model output.
 */
export function groundCandidates(
  extracted: ExtractedCandidate[],
  results: WebResult[],
): PartnerCandidate[] {
  const out: PartnerCandidate[] = [];
  for (const { sourceIds, ...candidate } of extracted) {
    const sources = [...new Set(sourceIds)].map((id) => results[id]).filter(Boolean);
    if (sources.length === 0 || sources.length !== new Set(sourceIds).size) continue;
    const host = hostOf(candidate.url);
    if (!host || !sources.some((s) => hostOf(s.url) === host)) continue;
    out.push({
      ...candidate,
      evidence: sources.map((s) => ({
        url: s.url,
        title: s.title,
        excerpt: s.highlights.join(" … ").slice(0, 1000),
      })),
    });
  }
  return out;
}

/** One candidate per site, best fit first, at most MAX_CANDIDATES. */
export function rankCandidates(candidates: PartnerCandidate[]): PartnerCandidate[] {
  const best = new Map<string, PartnerCandidate>();
  for (const c of candidates) {
    const host = hostOf(c.url)!;
    const current = best.get(host);
    if (!current || c.fitScore > current.fitScore) best.set(host, c);
  }
  return [...best.values()]
    .sort((a, b) => b.fitScore - a.fitScore || a.communityName.localeCompare(b.communityName))
    .slice(0, MAX_CANDIDATES);
}

// ---------- network-backed defaults ----------

function describeIntent(intent: EventIntent) {
  return [
    `Title: ${intent.title}`,
    `Topic: ${intent.topic}`,
    `Goal: ${intent.goal}`,
    `Format: ${intent.format}`,
    `City: ${intent.city}`,
    `Date: ${intent.date_start.slice(0, 10)}`,
    `Guests: ${intent.guest_count}`,
    `Sales boundary: ${intent.sales_boundary}`,
    `Partner criteria: ${intent.partner_criteria}`,
  ].join("\n");
}

export function defaultDeps(abortSignal?: AbortSignal): SearchDeps {
  return {
    async generateQueries(intent) {
      const { output } = await generateText({
        model: MODEL,
        abortSignal,
        output: Output.object({
          schema: z.object({ queries: z.array(z.string().min(3).max(200)).min(3).max(5) }),
        }),
        instructions:
          "You write web search queries that find communities (meetups, associations, newsletters, " +
          "Slack/Discord groups, nonprofits) that could co-host an event. Return 3-5 distinct queries " +
          "that each describe the community page you hope to find, in natural language.",
        prompt: describeIntent(intent),
      });
      return output.queries;
    },

    async search(query) {
      const apiKey = process.env.EXA_API_KEY;
      if (!apiKey) throw new Error("EXA_API_KEY is not set");
      const { results } = await new Exa(apiKey).search(query, {
        type: "auto",
        numResults: 8,
        contents: { highlights: true },
      });
      return results.map((r) => ({
        url: r.url,
        title: r.title ?? r.url,
        highlights: r.highlights ?? [],
      }));
    },

    async extract(intent, results) {
      const sources = results
        .map((r, i) => `[${i}] ${r.title}\n${r.url}\n${r.highlights.join(" … ").slice(0, 1200)}`)
        .join("\n\n");
      const { output } = await generateText({
        model: MODEL,
        abortSignal,
        output: Output.object({
          schema: z.object({ candidates: z.array(extractedCandidateSchema).max(15) }),
        }),
        instructions:
          "From the numbered search results, identify communities that could co-host the event. " +
          "Use only facts stated in the results; do not invent audiences, sizes or formats. " +
          "Cite the result numbers you used in sourceIds, and use the community's own URL from those results. " +
          "Skip vendors, venues for hire, ticketing sites, directories and news articles. " +
          "fitScore is 0-100: how well the community's audience and formats match the event and partner criteria. " +
          "List concrete risks (audience mismatch, competitor ties, conflicts with the sales boundary). " +
          "suggestedOutreachAngle is one or two sentences on why this community would want to co-host.",
        prompt: `Event:\n${describeIntent(intent)}\n\nSearch results:\n${sources}`,
      });
      return output.candidates;
    },
  };
}
