import type { EventIntent } from "../intent";
import type { ToolResponse } from "../tool-response";
import {
  MIN_CANDIDATES,
  searchCohostPartners,
  type PartnerCandidate,
  type SearchDeps,
} from "./search.ts";

export const SEARCH_COST_CREDITS = 3;

export type SavedCandidate = PartnerCandidate & { id: string };

/** Persistence and billing for a partner search. Implemented in ./store.ts. */
export interface PartnerStore {
  loadIntent(eventId: string, userId: string): Promise<EventIntent | null>;
  /** Candidates of an already-recorded search, best first; null if it never completed. */
  loadSearch(searchId: string, userId: string): Promise<SavedCandidate[] | null>;
  creditBalance(userId: string): Promise<number>;
  /**
   * Saves the candidates with their evidence and debits `cost` credits as one
   * unit, keyed by `searchId` so a retried call never charges twice.
   * Returns "insufficient_credits" if the balance dropped below `cost`, or
   * "already_recorded" if this searchId was saved by an earlier attempt.
   */
  recordSearch(input: {
    searchId: string;
    eventId: string;
    userId: string;
    queries: string[];
    candidates: PartnerCandidate[];
    cost: number;
  }): Promise<{ candidateIds: string[] } | "insufficient_credits" | "already_recorded">;
  audit(entry: {
    userId: string;
    eventId: string;
    action: "search_cohost_partners";
    outcome: ToolResponse["status"];
    detail: Record<string, unknown>;
  }): Promise<void>;
}

export type SearchCohostPartnersData = {
  searchId: string;
  creditsCharged: number;
  candidates: SavedCandidate[];
};

export async function runSearchCohostPartners(input: {
  eventId: string;
  userId: string;
  searchId: string;
  store: PartnerStore;
  deps?: SearchDeps;
}): Promise<ToolResponse<SearchCohostPartnersData>> {
  const { eventId, userId, searchId, store } = input;

  const respond = async (
    response: ToolResponse<SearchCohostPartnersData>,
    detail: Record<string, unknown> = {},
  ) => {
    // The audit trail must not turn a finished search into a failure.
    await store
      .audit({ userId, eventId, action: "search_cohost_partners", outcome: response.status, detail: { searchId, ...detail } })
      .catch((e) => console.error("[search_cohost_partners] audit failed", e));
    return response;
  };

  const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

  /** `replayed`: the charge was made by an earlier attempt, so the audit must not count it again. */
  const success = (candidates: SavedCandidate[], { queries, replayed = false }: { queries?: string[]; replayed?: boolean } = {}) => {
    const few = candidates.length < MIN_CANDIDATES;
    return respond({
      status: "success",
      summary:
        `Found ${candidates.length} co-host candidate${candidates.length === 1 ? "" : "s"}` +
        `${few ? " (fewer than usual; the niche may be narrow)" : ""}. Charged ${SEARCH_COST_CREDITS} credits.`,
      nextActions: [
        "Review the candidates and their evidence.",
        "Pick the communities to contact, then prepare an outreach batch.",
      ],
      data: { searchId, creditsCharged: SEARCH_COST_CREDITS, candidates },
    }, { queries, candidateCount: candidates.length, creditsCharged: replayed ? 0 : SEARCH_COST_CREDITS, replayed });
  };

  let intent: EventIntent | null;
  let balance: number;
  try {
    // A replayed call (crash after charging) returns the saved result: no new search, no new charge.
    const previous = await store.loadSearch(searchId, userId);
    if (previous) return success(previous, { replayed: true });
    [intent, balance] = await Promise.all([store.loadIntent(eventId, userId), store.creditBalance(userId)]);
  } catch (e) {
    console.error("[search_cohost_partners] loading failed", e);
    return respond({
      status: "failed",
      summary: "Could not load the event or credit balance. No credits were charged.",
      nextActions: ["Try again in a minute."],
    }, { error: errorMessage(e) });
  }

  if (!intent) {
    return respond({
      status: "failed",
      summary: "Event not found, or it belongs to someone else.",
      nextActions: ["Check the event id, or create the event first."],
    });
  }

  if (balance < SEARCH_COST_CREDITS) {
    return respond({
      status: "blocked",
      summary: `Partner search costs ${SEARCH_COST_CREDITS} credits; the balance is ${balance}.`,
      nextActions: ["Buy credits, then run the search again."],
    }, { balance });
  }

  let outcome;
  try {
    outcome = await searchCohostPartners(intent, input.deps);
  } catch (e) {
    console.error("[search_cohost_partners] search failed", e);
    return respond({
      status: "failed",
      // Covers web search outages and query/extraction model failures alike.
      summary: "The partner search failed. No credits were charged.",
      nextActions: ["Try again in a minute."],
    }, { error: errorMessage(e) });
  }

  const { queries, candidates } = outcome;
  if (candidates.length === 0) {
    return respond({
      status: "failed",
      summary: "No suitable co-host communities found. No credits were charged.",
      nextActions: ["Broaden the event's topic or partner criteria, then search again."],
    }, { queries });
  }

  let saved;
  try {
    saved = await store.recordSearch({ searchId, eventId, userId, queries, candidates, cost: SEARCH_COST_CREDITS });
  } catch (e) {
    console.error("[search_cohost_partners] saving failed", e);
    return respond({
      status: "failed",
      // recordSearch refunds on failure, but the refund itself can fail, so don't promise one.
      summary: "Found candidates but could not save them.",
      nextActions: ["Try again in a minute."],
    }, { queries, error: errorMessage(e) });
  }
  if (saved === "insufficient_credits") {
    return respond({
      status: "blocked",
      summary: `Partner search costs ${SEARCH_COST_CREDITS} credits and the balance is too low.`,
      nextActions: ["Buy credits, then run the search again."],
    }, { queries });
  }

  if (saved === "already_recorded") {
    const stored = await store.loadSearch(searchId, userId).catch((e) => {
      console.error("[search_cohost_partners] reloading failed", e);
      return null;
    });
    if (stored) return success(stored, { queries, replayed: true });
    return respond({
      status: "failed",
      summary: "This search was already saved, but its results could not be loaded.",
      nextActions: ["Try again in a minute."],
    }, { queries });
  }

  return success(candidates.map((c, i) => ({ ...c, id: saved.candidateIds[i] })), { queries });
}
