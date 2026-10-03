import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

// ---------- helpers ----------

function rootBlock() {
  const m = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, ":root block missing");
  return m[1];
}

function token(name) {
  // (?:^|\s) so "--border" doesn't match "--sidebar-border"
  const m = rootBlock().match(new RegExp(`(?:^|\\s)--${name}:\\s*([^;]+);`));
  assert.ok(m, `--${name} missing from :root`);
  return m[1].trim();
}

// "#rrggbb" or "rgb(r g b / a%)" -> { rgb: [r,g,b], a }
function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return { rgb: [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16)), a: 1 };
  const rgb = value.match(/^rgb\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+)%)?\)$/);
  assert.ok(rgb, `cannot parse color ${value}`);
  return { rgb: [rgb[1], rgb[2], rgb[3]].map(Number), a: rgb[4] === undefined ? 1 : Number(rgb[4]) / 100 };
}

const over = (top, bottomRgb) => top.rgb.map((c, i) => c * top.a + bottomRgb[i] * (1 - top.a));

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const APP_GLOW_OPACITY = 0.275;
const HERO_GLOW_OPACITY = 0.5;

// ---------- token values (spec "Tokens") ----------

test("core tokens hold the spec values", () => {
  assert.equal(token("background"), "#070505");
  assert.equal(token("foreground"), "#f5f2f0");
  assert.equal(token("card"), "rgb(255 255 255 / 3.5%)");
  assert.equal(token("popover"), "rgb(24 16 16 / 85%)");
  assert.equal(token("primary"), "#ffffff");
  assert.equal(token("primary-foreground"), "#1a0505");
  assert.equal(token("muted-foreground"), "rgb(255 255 255 / 55%)");
  assert.equal(token("border"), "rgb(255 255 255 / 10%)");
  assert.equal(token("input"), "rgb(255 255 255 / 12%)");
  assert.equal(token("ring"), "rgb(255 106 26 / 60%)");
  assert.equal(token("destructive"), "#ff4d4d");
  assert.equal(token("success"), "#34d399");
  assert.equal(token("warning"), "#fbbf24");
  assert.equal(token("brand-cherry"), "#e1122b");
  assert.equal(token("brand-orange"), "#ff6a1a");
  assert.equal(token("brand-amber"), "#ffc08a");
  assert.equal(token("glass-inset"), "rgb(10 6 6 / 35%)");
  assert.equal(token("radius"), "0.875rem");
});

test("dark only: no light palette block, html carries the dark class, no Arial", () => {
  assert.doesNotMatch(css, /^\.dark\s*\{/m, "remove the separate .dark block; :root is the dark palette");
  assert.match(css, /color-scheme:\s*dark/);
  assert.doesNotMatch(css, /Arial/);
  assert.match(layout, /className=\{`[^`]*\bdark\b/);
});

test("glass utilities and glow intensities exist", () => {
  for (const u of ["glass", "glass-inset", "glass-raised", "bg-brand-gradient", "bg-brand-gradient-text"]) {
    assert.match(css, new RegExp(`@utility ${u} \\{`), `@utility ${u} missing`);
  }
  assert.match(css, /blur\(24px\) saturate\(140%\)/);
  assert.match(css, new RegExp(`\\.cp-glow\\s*\\{[^}]*opacity:\\s*${APP_GLOW_OPACITY}`));
  assert.match(css, new RegExp(`\\.cp-glow\\[data-intensity="hero"\\]\\s*\\{[^}]*opacity:\\s*${HERO_GLOW_OPACITY}`));
  for (const s of ["idle", "listening", "thinking", "speaking"]) {
    assert.match(css, new RegExp(`\\.cp-orb\\[data-state="${s}"\\]`), `orb state ${s} missing`);
  }
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

// ---------- contrast (spec "Testing") ----------

const bg = parseColor(token("background")).rgb;
const fg = parseColor(token("foreground")).rgb;
const muted = parseColor(token("muted-foreground"));
const card = parseColor(token("card"));
const inset = parseColor(token("glass-inset"));

test("body and muted text on the page background are at least 4.5:1", () => {
  assert.ok(contrast(fg, bg) >= 4.5);
  assert.ok(contrast(over(muted, bg), bg) >= 4.5);
});

test("muted text on glass over the hottest app-glow pixel is at least 4.5:1", () => {
  const hottest = over({ rgb: parseColor(token("brand-orange")).rgb, a: APP_GLOW_OPACITY }, bg);
  const glass = over(card, hottest);
  const ratio = contrast(over(muted, glass), glass);
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}`);
});

test("body text in an inset field over the hottest hero-glow pixel is at least 4.5:1", () => {
  const hottest = over({ rgb: parseColor(token("glow-hot")).rgb, a: HERO_GLOW_OPACITY }, bg);
  const field = over(inset, hottest);
  const ratio = contrast(fg, field);
  assert.ok(ratio >= 4.5, `got ${ratio.toFixed(2)}`);
});

test("white text on the text-safe brand gradient is at least 4.5:1 at both ends", () => {
  const stops = css.match(/--brand-gradient-text:\s*linear-gradient\(135deg,\s*(#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)/i);
  assert.ok(stops, "--brand-gradient-text must be a two-stop hex gradient");
  for (const stop of [stops[1], stops[2]]) {
    const ratio = contrast([255, 255, 255], parseColor(stop).rgb);
    assert.ok(ratio >= 4.5, `${stop}: ${ratio.toFixed(2)}`);
  }
});

test("primary button text on white is at least 4.5:1", () => {
  assert.ok(contrast(parseColor(token("primary-foreground")).rgb, [255, 255, 255]) >= 4.5);
});
