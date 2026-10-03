import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalUrl,
  dedupeResults,
  fallbackQueries,
  groundCandidates,
  normalizeQueries,
  rankCandidates,
  searchCohostPartners,
} from "../src/lib/partners/search.ts";
import { runSearchCohostPartners, SEARCH_COST_CREDITS } from "../src/lib/partners/run.ts";

const intent = {
  title: "Berlin Founders Dinner",
  topic: "B2B SaaS",
  goal: "Networking",
  format: "dinner",
  city: "Berlin",
  date_start: "2026-11-14T19:00:00+01:00",
  date_end: "2026-11-14T23:00:00+01:00",
  guest_count: 20,
  budget_cap_cents: 300000,
  currency: "EUR",
  sales_boundary: "No pitching",
  partner_criteria: "B2B SaaS communities",
};

const result = (url, title = url) => ({ url, title, highlights: [`About ${title}`] });

const extracted = (url, fitScore, sourceIds, communityName = url) => ({
  communityName,
  url,
  audienceDescription: "SaaS founders",
  formatsObserved: ["dinners"],
  fitScore,
  fitReasons: ["Same audience"],
  risks: [],
  suggestedOutreachAngle: "Joint dinner",
  sourceIds,
});

// ---------- pure steps ----------

test("queries are trimmed, de-duplicated case-insensitively and capped at 5", () => {
  assert.deepEqual(
    normalizeQueries(["  a  b ", "A B", "", "c", "d", "e", "f", "g"]),
    ["a b", "c", "d", "e", "f"],
  );
});

test("fallback queries are built from topic, city and format", () => {
  const qs = fallbackQueries(intent);
  assert.equal(qs.length, 3);
  assert.ok(qs.every((q) => q.includes("B2B SaaS") && q.includes("Berlin")));
});

test("canonical URLs ignore www, trailing slashes, query and hash; reject non-http", () => {
  assert.equal(canonicalUrl("https://www.Example.com/club/?ref=x#top"), "example.com/club");
  assert.equal(canonicalUrl("http://example.com/club"), "example.com/club");
  assert.equal(canonicalUrl("javascript:alert(1)"), null);
  assert.equal(canonicalUrl("not a url"), null);
});

test("duplicate and invalid results are dropped", () => {
  const out = dedupeResults([
    result("https://a.com/x"),
    result("https://www.a.com/x/"),
    result("ftp://b.com"),
    result("https://c.com"),
  ]);
  assert.deepEqual(out.map((r) => r.url), ["https://a.com/x", "https://c.com"]);
});

test("grounding drops candidates with missing sources or a URL off the cited site", () => {
  const results = [result("https://saas-circle.de/about"), result("https://news.com/article")];
  const out = groundCandidates(
    [
      extracted("https://saas-circle.de", 80, [0]), // ok: same host as source 0
      extracted("https://made-up.org", 90, [0]), // URL not on any cited site
      extracted("https://saas-circle.de", 70, [5]), // source does not exist
      extracted("https://news.com", 60, [1, 9]), // one cited source does not exist
    ],
    results,
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].url, "https://saas-circle.de");
  assert.deepEqual(out[0].evidence, [
    { url: "https://saas-circle.de/about", title: "https://saas-circle.de/about", excerpt: "About https://saas-circle.de/about" },
  ]);
  assert.equal("sourceIds" in out[0], false);
});

test("ranking keeps the best candidate per site, sorts by fit and caps at 10", () => {
  const many = Array.from({ length: 14 }, (_, i) => ({
    ...extracted(`https://site${i}.com`, i * 5, [0]),
    evidence: [],
  }));
  many.push({ ...extracted("https://site13.com/other", 1, [0]), evidence: [] });
  const out = rankCandidates(many);
  assert.equal(out.length, 10);
  assert.equal(out[0].url, "https://site13.com");
  assert.ok(out.every((c, i) => i === 0 || out[i - 1].fitScore >= c.fitScore));
});

// ---------- pipeline with fake network ----------

function fakeDeps(overrides = {}) {
  return {
    generateQueries: async () => ["q1", "q2", "q3"],
    search: async (q) => [result(`https://${q}.com/community`)],
    extract: async (_intent, results) =>
      results.map((r, i) => extracted(r.url, 50 + i, [i])),
    ...overrides,
  };
}

test("pipeline returns ranked, grounded candidates", async () => {
  const { queries, candidates } = await searchCohostPartners(intent, fakeDeps());
  assert.deepEqual(queries, ["q1", "q2", "q3"]);
  assert.deepEqual(candidates.map((c) => c.fitScore), [52, 51, 50]);
  assert.ok(candidates.every((c) => c.evidence.length === 1));
});

test("pipeline falls back to template queries when query generation fails", async () => {
  const { queries } = await searchCohostPartners(
    intent,
    fakeDeps({ generateQueries: async () => { throw new Error("model down"); } }),
  );
  assert.deepEqual(queries, fallbackQueries(intent));
});

test("pipeline tolerates some failed searches but throws when all fail", async () => {
  let n = 0;
  const partial = await searchCohostPartners(
    intent,
    fakeDeps({ search: async (q) => { if (n++ === 0) throw new Error("timeout"); return [result(`https://${q}.com`)]; } }),
  );
  assert.equal(partial.candidates.length, 2);

  await assert.rejects(
    searchCohostPartners(intent, fakeDeps({ search: async () => { throw new Error("down"); } })),
    /every query/,
  );
});

test("pipeline skips extraction when the web has nothing", async () => {
  let extractCalled = false;
  const out = await searchCohostPartners(
    intent,
    fakeDeps({ search: async () => [], extract: async () => { extractCalled = true; return []; } }),
  );
  assert.deepEqual(out.candidates, []);
  assert.equal(extractCalled, false);
});

// ---------- credits, persistence and response envelope ----------

function fakeStore({ balance = 10, intentFound = true, record, saved = null } = {}) {
  const calls = { record: [], audit: [] };
  return {
    calls,
    store: {
      loadIntent: async () => (intentFound ? intent : null),
      loadSearch: async () => saved,
      creditBalance: async () => balance,
      recordSearch: async (input) => {
        calls.record.push(input);
        return record ? record(input) : { candidateIds: input.candidates.map((_, i) => `id-${i}`) };
      },
      audit: async (entry) => { calls.audit.push(entry); },
    },
  };
}

const run = (store, deps = fakeDeps()) =>
  runSearchCohostPartners({ eventId: "e1", userId: "u1", searchId: "s1", store, deps });

test("success charges 3 credits once and returns candidates with ids", async () => {
  const { store, calls } = fakeStore();
  const res = await run(store);
  assert.equal(res.status, "success");
  assert.equal(res.data.creditsCharged, SEARCH_COST_CREDITS);
  assert.deepEqual(res.data.candidates.map((c) => c.id), ["id-0", "id-1", "id-2"]);
  assert.equal(calls.record.length, 1);
  assert.equal(calls.record[0].cost, 3);
  assert.equal(calls.record[0].searchId, "s1");
  assert.ok(res.nextActions.length > 0);
  assert.equal(calls.audit[0].outcome, "success");
});

test("low balance blocks before any web search", async () => {
  let searched = false;
  const { store, calls } = fakeStore({ balance: 2 });
  const res = await run(store, fakeDeps({ search: async () => { searched = true; return []; } }));
  assert.equal(res.status, "blocked");
  assert.equal(searched, false);
  assert.equal(calls.record.length, 0);
});

test("no candidates means no charge", async () => {
  const { store, calls } = fakeStore();
  const res = await run(store, fakeDeps({ search: async () => [] }));
  assert.equal(res.status, "failed");
  assert.match(res.summary, /No credits were charged/);
  assert.equal(calls.record.length, 0);
});

test("search outage fails without charging", async () => {
  const { store, calls } = fakeStore();
  const res = await run(store, fakeDeps({ search: async () => { throw new Error("down"); } }));
  assert.equal(res.status, "failed");
  assert.equal(calls.record.length, 0);
  assert.equal(calls.audit[0].outcome, "failed");
});

test("unknown or foreign event fails", async () => {
  const { store } = fakeStore({ intentFound: false });
  assert.equal((await run(store)).status, "failed");
});

test("balance spent concurrently is reported as blocked", async () => {
  const { store } = fakeStore({ record: () => "insufficient_credits" });
  const res = await run(store);
  assert.equal(res.status, "blocked");
  assert.equal(res.data, undefined);
});

test("audit failure does not fail a finished search", async () => {
  const { store } = fakeStore();
  store.audit = async () => { throw new Error("audit table missing"); };
  const original = console.error;
  console.error = () => {};
  try {
    assert.equal((await run(store)).status, "success");
  } finally {
    console.error = original;
  }
});

const savedCandidate = { ...extracted("https://saas-circle.de", 80, [0]), id: "old-1", evidence: [] };
delete savedCandidate.sourceIds;

test("replayed call returns the saved result without searching or charging again", async () => {
  let searched = false;
  const { store, calls } = fakeStore({ saved: [savedCandidate] });
  const res = await run(store, fakeDeps({ search: async () => { searched = true; return []; } }));
  assert.equal(res.status, "success");
  assert.deepEqual(res.data.candidates.map((c) => c.id), ["old-1"]);
  assert.equal(searched, false);
  assert.equal(calls.record.length, 0);
});

test("a save already recorded by a concurrent attempt returns the stored candidates", async () => {
  let loads = 0;
  const { store } = fakeStore({ record: () => "already_recorded" });
  store.loadSearch = async () => (loads++ === 0 ? null : [savedCandidate]);
  const res = await run(store);
  assert.equal(res.status, "success");
  assert.deepEqual(res.data.candidates.map((c) => c.id), ["old-1"]);
});

test("a failed save reports failure instead of throwing", async () => {
  const { store } = fakeStore({ record: () => { throw new Error("insert failed"); } });
  const original = console.error;
  console.error = () => {};
  try {
    const res = await run(store);
    assert.equal(res.status, "failed");
    assert.match(res.summary, /refunded/);
  } finally {
    console.error = original;
  }
});
