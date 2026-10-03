import assert from "node:assert/strict";
import test from "node:test";
import { glowIntensityFor } from "../src/components/brand/glow-route.ts";

test("sign-in and agent consent screens get the hero glow", () => {
  for (const p of ["/login", "/login/reset", "/oauth/consent"]) assert.equal(glowIntensityFor(p), "hero", p);
});

test("app screens and long forms get the app glow", () => {
  for (const p of ["/", "/events/new", "/events/123", "/inbox", "/profile", "/onboarding", "/browse", "/design"]) {
    assert.equal(glowIntensityFor(p), "app", p);
  }
});

test("prefix match is by path segment, not by string", () => {
  assert.equal(glowIntensityFor("/loginx"), "app");
  assert.equal(glowIntensityFor("/oauthors"), "app");
});
