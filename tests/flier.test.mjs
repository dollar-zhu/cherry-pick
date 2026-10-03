import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  FONT_SETS,
  VIBES,
  backgroundPrompt,
  fitTitle,
  flierText,
  hostedByLine,
  pickStyle,
  refinePrompt,
  vibeForFormat,
} from "../src/lib/flier/design.ts";

const facts = {
  title: "Reliable AI Agents in Production",
  topic: "candid stories from platform leaders",
  format: "dinner",
  guestCount: 14,
  city: "San Francisco",
  timezone: "America/Los_Angeles",
  // 7–10pm Pacific on Wed Nov 11, stored as UTC.
  dateStart: "2026-11-12T03:00:00Z",
  dateEnd: "2026-11-12T06:00:00Z",
  datesFlexible: false,
  hostName: "Northwind AI",
  cohostNames: ["Bay Area Platform Guild"],
};

test("every font set's files are bundled", () => {
  for (const set of FONT_SETS) {
    for (const face of [set.display, set.body, set.bodyStrong]) {
      assert.ok(existsSync(new URL(`../assets/fonts/${face.file}`, import.meta.url)), face.file);
    }
  }
});

test("flier text uses the event time zone and only public facts", () => {
  const text = flierText(facts);
  assert.equal(text.when, "Wed, Nov 11 · 7:00 PM – 10:00 PM");
  assert.equal(text.kicker, "Dinner for 14 · Invite only");
  assert.equal(text.subtitle, "Candid stories from platform leaders");
  assert.equal(text.hostedBy, "Hosted by Northwind AI × Bay Area Platform Guild");
  assert.ok(!JSON.stringify(text).match(/budget|\$|pipeline/i));
});

test("flexible dates show the month window, not a fake date", () => {
  const text = flierText({ ...facts, datesFlexible: true, dateEnd: "2026-12-20T06:00:00Z" });
  assert.equal(text.when, "November 2026 – December 2026 · date to be announced");
});

test("hosted-by line handles no hosts and long lists", () => {
  assert.equal(hostedByLine(null, []), null);
  assert.equal(hostedByLine("A", ["B", "C", "D"]), "Hosted by A × B + 2 more");
});

test("long titles shrink to fit, short ones stay big", () => {
  const set = FONT_SETS.find((f) => f.id === "editorial");
  const short = fitTitle("AI Dinner", set, { width: 904 });
  const long = fitTitle("Platform Engineering Leaders Roundtable on Reliable Agent Infrastructure", set, { width: 904 });
  assert.equal(short.size, 150);
  assert.ok(long.size < short.size && long.lines <= 3);
});

test("style: requested vibe wins, then the format's vibe; restyle avoids the old fonts", () => {
  const random = () => 0;
  assert.equal(pickStyle("dinner", random, { vibe: "liquid-chrome" }).vibe, "liquid-chrome");
  assert.equal(pickStyle("Wine dinner", random).vibe, "candlelit");
  assert.equal(vibeForFormat("conference"), null);
  assert.notEqual(pickStyle("dinner", random, {}, { fontSet: FONT_SETS[0].id }).fontSet, FONT_SETS[0].id);
});

test("prompts never ask the model for text", () => {
  for (const vibe of VIBES) {
    const prompt = backgroundPrompt({ vibe: vibe.id, layout: "bottom" }, "dinner");
    assert.match(prompt, /no text, letters/);
    assert.ok(!prompt.includes(facts.title));
  }
  assert.match(refinePrompt("darker", "center"), /^Edit this abstract flier background: darker\./);
});
