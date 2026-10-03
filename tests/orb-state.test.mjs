import assert from "node:assert/strict";
import test from "node:test";
import { ORB_STATES, orbLabel, toOrbState } from "../src/components/brand/orb-state.ts";

test("known states pass through", () => {
  for (const s of ORB_STATES) assert.equal(toOrbState(s), s);
});

test("unknown values fall back to idle instead of rendering nothing", () => {
  for (const v of ["LISTENING", "", " listening", "talking", undefined, null, 3, {}]) {
    assert.equal(toOrbState(v), "idle", `value ${JSON.stringify(v)}`);
  }
});

test("every state has a spoken label", () => {
  assert.deepEqual(ORB_STATES.map(orbLabel), ["Voice idle", "Listening", "Thinking", "Speaking"]);
});
