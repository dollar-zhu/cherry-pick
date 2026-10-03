import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN = ["src/app", "src/components"];
// Kit and brand components may hold literal colors; everything else uses tokens.
const EXEMPT = ["src/components/ui/", "src/components/brand/"];
// Files not yet moved onto the design system. PR 2 removes entries as it migrates them.
const PENDING = new Set([]);

const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|shadow|decoration|accent|caret)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|(?:black|white)(?![\w-]))/;
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/;

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* sourceFiles(full);
    else if (/\.(tsx|ts)$/.test(name)) yield full;
  }
}

const rel = (full) => relative(ROOT, full).split(sep).join("/");

function rawColors(source) {
  const hits = [];
  source.split("\n").forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*")) return;
    const m = line.match(PALETTE) ?? line.match(HEX);
    if (m) hits.push(`${i + 1}: ${m[0]}`);
  });
  return hits;
}

test("detector catches raw colors and ignores tokens", () => {
  assert.equal(rawColors('<p className="text-zinc-500">').length, 1);
  assert.equal(rawColors('<p className="dark:bg-red-600/20">').length, 1);
  assert.equal(rawColors('style={{ color: "#fff" }}').length, 1);
  assert.equal(rawColors('style={{ color: "#1a0505" }}').length, 1);
  assert.equal(rawColors('<p className="bg-primary text-muted-foreground border-border">').length, 0);
  assert.equal(rawColors('<p className="bg-destructive/10 text-success">').length, 0);
  assert.equal(rawColors('<a href="#details">').length, 0);
  assert.equal(rawColors("// was text-zinc-500, see #123").length, 0);
  assert.equal(rawColors('<div className="bg-white p-4">').length, 1);
  assert.equal(rawColors('<p className="text-black">').length, 1);
  assert.equal(rawColors('<dialog className="backdrop:bg-black/40">').length, 1);
  assert.equal(rawColors('<p className="bg-white/95">').length, 1);
  assert.equal(rawColors('<p className="text-primary-foreground bg-foreground/20">').length, 0);
});

test("pages and components use design tokens, not raw colors", () => {
  const offenders = [];
  for (const dir of SCAN) {
    for (const full of sourceFiles(join(ROOT, dir))) {
      const path = rel(full);
      if (EXEMPT.some((e) => path.startsWith(e)) || PENDING.has(path)) continue;
      for (const hit of rawColors(readFileSync(full, "utf8"))) offenders.push(`${path}:${hit}`);
    }
  }
  assert.deepEqual(offenders, [], "use tokens (bg-primary, text-muted-foreground, …), see /design");
});

test("every pending file still exists and still has raw colors (else remove it from PENDING)", () => {
  for (const path of PENDING) {
    assert.ok(existsSync(join(ROOT, path)), `${path} no longer exists`);
    assert.ok(rawColors(readFileSync(join(ROOT, path), "utf8")).length > 0, `${path} is clean, remove it from PENDING`);
  }
});

test("every page is on the design system (PENDING is empty)", () => {
  assert.equal(PENDING.size, 0, `still pending: ${[...PENDING].join(", ")}`);
});

test("hand-made text fields use glass-inset, not the panel glass", () => {
  // The panel `glass` on a field matches the card it sits in and adds a drop shadow.
  const offenders = [];
  for (const dir of SCAN) {
    for (const full of sourceFiles(join(ROOT, dir))) {
      const path = rel(full);
      if (EXEMPT.some((e) => path.startsWith(e))) continue;
      const src = readFileSync(full, "utf8");
      const fieldClasses = [
        ...src.matchAll(/const \w*[iI]nput\w* =\s*"([^"]*)"/g),
        ...src.matchAll(/<(?:input|textarea|select)\b[^>]*className="([^"]*)"/g),
      ].map((m) => m[1]);
      for (const cls of fieldClasses) if (/(^|\s)glass(\s|$)/.test(cls)) offenders.push(`${path}: ${cls}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("sticky chat footers don't paint an opaque block over the glow", () => {
  for (const path of ["src/components/assistant/thread.tsx", "src/components/assistant/voice-chat.tsx"]) {
    const src = readFileSync(join(ROOT, path), "utf8");
    for (const m of src.matchAll(/className="([^"]*\bsticky bottom-0\b[^"]*)"/g)) {
      assert.doesNotMatch(m[1], /(^|\s)bg-background(\s|$)/, `${path}: ${m[1]}`);
    }
  }
});
