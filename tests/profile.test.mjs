import assert from "node:assert/strict";
import test from "node:test";
import { Profile, readProfileForm } from "../src/lib/contracts.ts";

function venueForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    name: "Test venue", description: "Workshop space", city: "San Francisco",
    audience: "Developers", topics: "AI", has_venue: "on", venue_capacity: "60",
  })) form.set(key, value);
  return form;
}

test("unconfirmed venue details remain unknown, even with stale selections", () => {
  const form = venueForm();
  form.set("amenities", "wifi");
  form.set("available_weekdays", "4");
  const profile = Profile.parse(readProfileForm(form));
  assert.equal(profile.amenities, null);
  assert.equal(profile.available_weekdays, null);
});

test("confirmed empty lists remain distinct from unknown", () => {
  const form = venueForm();
  form.set("amenities_confirmed", "on");
  form.set("weekdays_confirmed", "on");
  const profile = Profile.parse(readProfileForm(form));
  assert.deepEqual(profile.amenities, []);
  assert.deepEqual(profile.available_weekdays, []);
});

test("confirmed selections preserve amenities and Postgres weekday numbers", () => {
  const form = venueForm();
  form.set("amenities_confirmed", "on");
  form.set("weekdays_confirmed", "on");
  form.set("amenities", "step_free_access");
  form.set("available_weekdays", "4");
  const profile = Profile.parse(readProfileForm(form));
  assert.deepEqual(profile.amenities, ["step_free_access"]);
  assert.deepEqual(profile.available_weekdays, [4]);
});

test("unchecking the venue discards invalid or stale venue fields", () => {
  const form = venueForm();
  form.delete("has_venue");
  form.set("venue_capacity", "0");
  form.set("available_from", "not-a-date");
  form.set("amenities_confirmed", "on");
  form.set("amenities", "wifi");
  const profile = Profile.parse(readProfileForm(form));
  for (const key of ["venue_capacity", "amenities", "available_weekdays", "available_from", "available_to"])
    assert.equal(profile[key], null);
});

test("reversed date range returns an actionable end-date error", () => {
  const form = venueForm();
  form.set("available_from", "2026-12-01");
  form.set("available_to", "2026-10-01");
  const result = Profile.safeParse(readProfileForm(form));
  assert.equal(result.success, false);
  assert.deepEqual(result.error.issues[0].path, ["available_to"]);
  assert.equal(result.error.issues[0].message, "The end date must be on or after the start date.");
});

test("calendar validation rejects impossible dates and permits valid ranges", () => {
  const form = venueForm();
  for (const date of ["2026-99-99", "2026-02-29", "2026-04-31"] ) {
    form.set("available_from", date);
    assert.equal(Profile.safeParse(readProfileForm(form)).success, false, date);
  }
  for (const [start, end] of [["2028-02-29", "2028-03-01"], ["2026-10-03", "2026-10-03"], ["2026-10-03", ""]]) {
    form.set("available_from", start);
    form.set("available_to", end);
    assert.equal(Profile.safeParse(readProfileForm(form)).success, true);
  }
});

test("website link is optional and gets https:// when the scheme is missing", () => {
  const form = venueForm();
  assert.equal(Profile.parse(readProfileForm(form)).website_url, null);
  form.set("website_url", "acme.com");
  assert.equal(Profile.parse(readProfileForm(form)).website_url, "https://acme.com");
});
