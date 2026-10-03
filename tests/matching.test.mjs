import assert from "node:assert/strict";
import test from "node:test";
import {
  cityIlikePattern,
  dedupeRankings,
  exclusionReason,
  openQuestions,
  sameCity,
  topicOverlap,
} from "../src/lib/matching-constraints.ts";

// Venue fields of the demo rows in supabase/seed.sql.
const venue = (city, capacity, amenities, weekdays, from = "2026-10-01", to = "2026-12-31") => ({
  city, is_seeking_partners: true, has_venue: true, venue_capacity: capacity,
  amenities, available_weekdays: weekdays, available_from: from, available_to: to,
});
const seed = {
  "Mission Loft": venue("San Francisco", 80, ["projector", "wifi", "av_system", "step_free_access", "accessible_restroom"], [2, 4]),
  "SoMa Founders": venue("San Francisco", 120, ["projector", "wifi", "av_system", "catering", "step_free_access", "accessible_restroom"], [1, 2, 3, 4, 5], "2026-10-01", "2027-03-31"),
  "FiDi Fintech": venue("San Francisco", 200, ["projector", "wifi", "av_system", "catering", "step_free_access", "accessible_restroom"], [2, 4]),
  "Presidio": venue("San Francisco", 70, null, [3, 4]),
  "Potrero": venue("San Francisco", 55, ["projector", "wifi", "parking"], [4]),
  "Bayview": venue("San Francisco", 60, ["projector", "wifi", "step_free_access"], [1, 3, 6]),
  "Dogpatch": venue("San Francisco", 50, ["projector", "wifi", "step_free_access", "accessible_restroom"], [5]),
  "Embarcadero": venue("San Francisco", 30, ["projector", "wifi"], [2, 4]),
  "Hayes Valley": venue("San Francisco", 40, ["wifi", "catering", "step_free_access"], [4, 6]),
  "Oakland Robotics": venue("Oakland", 100, ["projector", "wifi", "parking", "step_free_access"], [4]),
  "Tenderloin": { ...venue("San Francisco", 90, ["projector", "wifi", "step_free_access", "accessible_restroom"], [4]), is_seeking_partners: false },
  "Russian Hill": venue("San Francisco", 75, ["wifi", "catering"], [4, 5], "2026-06-01", "2026-09-30"),
  "Marina Wellness": venue("San Francisco", 60, ["wifi", "step_free_access"], [4]),
  "Nob Hill": venue("San Francisco", 50, ["kitchen", "catering", "wifi"], [4, 5, 6]),
  "Sunset AI Students": {
    city: "San Francisco", is_seeking_partners: true, has_venue: false, venue_capacity: null,
    amenities: null, available_weekdays: null, available_from: null, available_to: null,
  },
};

// Demo story: an SF venue for a 50-person workshop, any day Oct–Dec, then "Thursdays only".
const demo = {
  city: "San Francisco",
  guest_count: 50,
  date_start: "2026-10-05T18:00:00-07:00",
  date_end: "2026-12-20T21:00:00-08:00",
  dates_flexible: true,
  allowed_weekdays: null,
  needs_venue: true,
  required_amenities: [],
};

const passing = (event) =>
  Object.entries(seed).filter(([, p]) => exclusionReason(p, event) === null).map(([name]) => name).sort();

test("demo: venue, city, capacity, seeking, and dates remove the rows the seed marks", () => {
  assert.deepEqual(passing(demo), [
    "Bayview", "Dogpatch", "FiDi Fintech", "Marina Wellness", "Mission Loft",
    "Nob Hill", "Potrero", "Presidio", "SoMa Founders",
  ]);
  assert.equal(exclusionReason(seed["Sunset AI Students"], demo), "No venue");
  assert.equal(exclusionReason(seed["Embarcadero"], demo), "Venue too small");
  assert.equal(exclusionReason(seed["Oakland Robotics"], demo), "Different city");
  assert.equal(exclusionReason(seed["Tenderloin"], demo), "Not seeking partners");
  assert.equal(exclusionReason(seed["Russian Hill"], demo), "Outside available dates");
});

test('demo: "Thursdays only" removes Bayview and Dogpatch', () => {
  const thursdays = passing({ ...demo, allowed_weekdays: [4] });
  assert.ok(!thursdays.includes("Bayview"));
  assert.ok(!thursdays.includes("Dogpatch"));
  assert.ok(thursdays.includes("Mission Loft"));
});

test("demo: step-free access removes known misses and keeps unknowns with a question", () => {
  const event = { ...demo, allowed_weekdays: [4], required_amenities: ["step_free_access"] };
  assert.equal(exclusionReason(seed["Potrero"], event), "Missing a required amenity");
  assert.equal(exclusionReason(seed["Presidio"], event), null);
  assert.deepEqual(openQuestions(seed["Presidio"], event), ["Ask if the venue has: step_free_access."]);
  assert.deepEqual(openQuestions(seed["Mission Loft"], event), []);
});

test("without a venue need, a company with no venue is a valid co-host", () => {
  const event = { ...demo, needs_venue: false };
  assert.equal(exclusionReason(seed["Sunset AI Students"], event), null);
  assert.equal(exclusionReason(seed["Embarcadero"], event), null);
  assert.deepEqual(openQuestions(seed["Sunset AI Students"], event), []);
  assert.equal(exclusionReason(seed["Tenderloin"], event), "Not seeking partners");
});

test("fixed dates: the venue must cover every day of the event", () => {
  const thuToSat = {
    ...demo, dates_flexible: false,
    date_start: "2026-10-08T18:00:00-07:00", date_end: "2026-10-10T21:00:00-07:00",
  };
  assert.equal(exclusionReason(seed["Nob Hill"], thuToSat), null, "open Thu, Fri, Sat");
  assert.equal(exclusionReason(seed["Mission Loft"], thuToSat), "Unavailable on the event weekdays");
  const lateDecember = { ...thuToSat, date_start: "2026-12-31T18:00:00-08:00", date_end: "2027-01-02T21:00:00-08:00" };
  assert.equal(exclusionReason(seed["Nob Hill"], lateDecember), "Outside available dates");
});

test("an empty weekday list is known to have none; null weekdays stay with a question", () => {
  const thursday = { ...demo, dates_flexible: false, date_start: "2026-10-08T18:00:00-07:00", date_end: "2026-10-08T21:00:00-07:00" };
  assert.equal(exclusionReason({ ...seed["Mission Loft"], available_weekdays: [] }, thursday), "Unavailable on the event weekdays");
  const unknown = { ...seed["Mission Loft"], venue_capacity: null, available_weekdays: null };
  assert.equal(exclusionReason(unknown, thursday), null);
  assert.deepEqual(openQuestions(unknown, thursday), ["Venue capacity is unknown.", "Ask which weekdays the venue is open."]);
});

test("location match is the whole city, ignoring case", () => {
  assert.equal(sameCity("San Francisco", "san francisco"), true);
  assert.equal(sameCity("  San Francisco  ", "San Francisco"), true);
  assert.equal(sameCity("San Francisco", "SF"), false);
  assert.equal(sameCity("San Francisco Bay", "San Francisco"), false);
});

test("city pattern treats wildcard characters as literal", () => {
  assert.equal(cityIlikePattern("  100%_sure  "), "100\\%\\_sure");
});

test("topic overlap matches whole words only", () => {
  assert.equal(topicOverlap(["AI", "startups"], "An AI workshop for startups"), 2);
  assert.equal(topicOverlap(["AI"], "Email marketing that we maintain"), 0);
});

test("duplicate rankings keep the higher score once", () => {
  const rows = dedupeRankings([
    { profileId: "a", score: 3, reasons: ["low"] },
    { profileId: "a", score: 8, reasons: ["high"] },
    { profileId: "b", score: 5, reasons: ["ok"] },
  ]);
  assert.deepEqual(rows.map((row) => row.profileId), ["a", "b"]);
  assert.equal(rows[0].score, 8);
});
