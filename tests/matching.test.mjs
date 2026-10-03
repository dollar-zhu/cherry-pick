import assert from "node:assert/strict";
import test from "node:test";
import {
  cityMatches,
  dedupeRankings,
  matchesHardConstraints,
} from "../src/lib/matching-constraints.ts";

// Thursday evening, 50 guests. Mirrors the demo story in supabase/seed.sql.
const event = {
  city: "San Francisco",
  guest_count: 50,
  date_start: "2026-10-08T18:00:00-07:00",
  date_end: "2026-10-08T21:00:00-07:00",
};

function profile(overrides) {
  return {
    is_seeking_partners: true,
    venue_capacity: 80,
    available_weekdays: [4],
    available_from: "2026-10-01",
    available_to: "2026-12-31",
    ...overrides,
  };
}

test("demo hard constraints remove the rows the seed marks as removed", () => {
  assert.equal(matchesHardConstraints(profile({}), event), true, "thursday venue");
  assert.equal(
    matchesHardConstraints(profile({ is_seeking_partners: false }), event),
    false,
    "not seeking",
  );
  assert.equal(
    matchesHardConstraints(profile({ venue_capacity: 30 }), event),
    false,
    "capacity under guest count",
  );
  assert.equal(
    matchesHardConstraints(profile({ available_weekdays: [1, 3, 6] }), event),
    false,
    "no thursday",
  );
  assert.equal(
    matchesHardConstraints(
      profile({ available_from: "2026-06-01", available_to: "2026-09-30" }),
      event,
    ),
    false,
    "availability ended",
  );
});

test("unknown venue fields stay in the set, and an empty weekday list does not", () => {
  assert.equal(
    matchesHardConstraints(
      profile({
        venue_capacity: null,
        available_weekdays: null,
        available_from: null,
        available_to: null,
      }),
      event,
    ),
    true,
  );
  assert.equal(
    matchesHardConstraints(profile({ available_weekdays: [] }), event),
    false,
  );
});

test("a multi-day event keeps a venue available on any day in the span", () => {
  const span = {
    ...event,
    date_start: "2026-10-08T18:00:00-07:00",
    date_end: "2026-10-10T21:00:00-07:00",
  };
  assert.equal(
    matchesHardConstraints(profile({ available_weekdays: [6] }), span),
    true,
    "saturday falls in thu–sat",
  );
});

test("city match is a case-insensitive substring", () => {
  assert.equal(cityMatches("San Francisco", "san francisco"), true);
  assert.equal(cityMatches("San Francisco", "SF"), false);
  assert.equal(cityMatches("Oakland", "San Francisco"), false);
});

test("duplicate rankings keep the higher score once", () => {
  const rows = dedupeRankings([
    { profileId: "a", score: 3, reasons: ["low"] },
    { profileId: "a", score: 8, reasons: ["high"] },
    { profileId: "b", score: 5, reasons: ["ok"] },
  ]);
  assert.deepEqual(
    rows.map((row) => row.profileId),
    ["a", "b"],
  );
  assert.equal(rows[0].score, 8);
  assert.deepEqual(rows[0].reasons, ["high"]);
});
