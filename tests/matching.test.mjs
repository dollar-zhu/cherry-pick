import assert from "node:assert/strict";
import test from "node:test";
import {
  cityIlikePattern,
  dedupeRankings,
  sameCity,
} from "../src/lib/matching-constraints.ts";

test("location match is the whole city, ignoring case", () => {
  assert.equal(sameCity("San Francisco", "san francisco"), true);
  assert.equal(sameCity("  San Francisco  ", "San Francisco"), true);
  assert.equal(sameCity("San Francisco", "SF"), false);
  assert.equal(sameCity("Oakland", "San Francisco"), false);
  assert.equal(sameCity("San Francisco Bay", "San Francisco"), false);
});

test("city pattern treats wildcard characters as literal", () => {
  assert.equal(cityIlikePattern("San Francisco"), "San Francisco");
  assert.equal(cityIlikePattern("  100%_sure  "), "100\\%\\_sure");
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
