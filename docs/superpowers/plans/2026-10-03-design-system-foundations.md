# Design System Foundations (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Cherry Pick design system's foundation: dark gradient-glass tokens, glass utilities, restyled shadcn kit components, brand components (Logo, Glow, Orb, PageHeader, EmptyState), favicon, a dev-only `/design` reference page, and tests that keep pages on the tokens.

**Architecture:** Restyle the shadcn `base-nova` kit from PR #8 through CSS variables in `src/app/globals.css` plus small `cva` edits, so `npx shadcn add` keeps working. Brand-only pieces live in `src/components/brand/`. Pure Node tests (`node --test`, which imports `.ts` directly) check the token values, the contrast math and a raw-color guard. Visual checks happen on `/design`.

**Tech Stack:** Next.js 16.3 (App Router), React 19, Tailwind CSS v4 (`@theme`, `@utility`), shadcn `base-nova` (Base UI), `class-variance-authority`, `cn`, lucide-react, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-design-system-design.md` (read it first). Visual reference: https://claude.ai/artifact/5F9SrBYyk3SYRip2oqJG1S

**Scope of this plan:** PR 1 only. PR 2 (app layout and pages), PR 3 (chat and Orb wiring) and PR 4 (invite email) each get their own plan after this lands. Their target files are still changing in PR #8, SUP-10, the voice work and SUP-20.

## Global Constraints

- **Do not start until PR #8 (`codex/auth-flow`) is merged into `main`.** Every task edits files that PR adds.
- Dark theme only: `<html>` always has class `dark`, and there is no light palette. Desktop only.
- Restyle shadcn through tokens and small `cva` edits. Do not rewrite kit components or swap their primitives.
- Before using a Next.js API (fonts, `icon.png`, `notFound`, `next/image`), read its page in `node_modules/next/dist/docs/` (per `AGENTS.md`).
- Font: Geist Sans via `next/font/google` (already in `layout.tsx`), plus Geist Mono for code and tokens.
- Glass `glass`: fill `rgb(255 255 255 / 3.5%)`, `blur(24px) saturate(140%)`, 1px border `rgb(255 255 255 / 10%)`, `inset 0 1px 0 rgb(255 255 255 / 8%)`, `0 10px 30px rgb(0 0 0 / 25%)`.
- Glow opacity: `app` = 0.275 (hottest color `--brand-orange`, no white core), `hero` = 0.5 (warm-white core). One smooth glow, no columns or bands.
- Colors by role: white = primary action, `--brand-gradient-text` = AI/brand actions with text, `--brand-gradient` = decoration only, red = destructive, green = success.
- Text contrast is at least 4.5:1 everywhere text sits.
- No raw Tailwind palette classes (`zinc-*`, `red-*`, …) or hex colors in `src/app/**/*.tsx|ts` or `src/components/**` outside `ui/` and `brand/`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

1. **Text over the hottest part of the glow.** Muted text on glass scrolling over the bottom-center of the app glow must stay at least 4.5:1. This is pinned by the contrast test in Task 2 (app glow has no white core).
2. **White text on the brand gradient.** The brand button and user bubble must use `--brand-gradient-text`, not `--brand-gradient`. This is pinned by the contrast test in Task 2 and by the button variant in Task 4.
3. **Raw colors creeping back into pages.** Someone adds `text-zinc-500` or `#fff` in a page. This is pinned by the guard test in Task 3, including the "pending list must shrink" check.
4. **`/design` leaking to production.** The reference page must 404 in production builds. This is pinned by the `notFound()` guard in Task 7 and checked against a production build in Task 8.
5. **Orb receiving an unknown state.** The voice feature passes a raw string such as `"LISTENING"` or `undefined`, and the Orb must fall back to `idle` instead of rendering nothing. This is pinned by `toOrbState` tests in Task 6.

---

### Task 1: Branch and bring in the spec and logo files

**Files:**
- Create: `docs/superpowers/specs/2026-10-03-design-system-design.md` (carry over from the SUP-25 working tree, where it is untracked)
- Create: `docs/superpowers/specs/assets/*.png` (same)
- Create: `docs/superpowers/plans/2026-10-03-design-system-foundations.md` (this file)

**Interfaces:**
- Produces: branch `abidanalyze/design-system-foundations` from up-to-date `main`.

- [ ] **Step 1: Confirm PR #8 is merged**

Run: `gh pr view 8 --json state,mergedAt --jq '.state + " " + (.mergedAt // "")'`
Expected: `MERGED 2026-…`. If it prints `OPEN`, stop and wait.

- [ ] **Step 2: Branch from fresh main, keeping the untracked docs**

Untracked files follow you across `git switch`, so the spec, assets and plan come along.

```bash
git switch main
git pull --ff-only
git switch -c abidanalyze/design-system-foundations
git status --short docs/
```

Expected: `?? docs/superpowers/` (untracked). If `git switch main` refuses because of local changes, run `git stash` first, then `git stash pop` after branching.

- [ ] **Step 3: Confirm the kit landed**

Run: `ls src/components/ui/ components.json src/lib/utils.ts && grep -n '"cn"\|class-variance-authority\|lucide-react' package.json`
Expected: `alert.tsx button.tsx card.tsx input.tsx label.tsx`, `components.json`, `src/lib/utils.ts`, and all three packages listed.

- [ ] **Step 4: Commit the docs**

```bash
git add docs/superpowers
git commit -m "docs: design system spec, logo assets and PR 1 plan

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Dark tokens, glass utilities, glow and orb CSS

**Files:**
- Modify: `src/app/globals.css` (replace the whole file)
- Modify: `src/app/layout.tsx` (`<html>` class, metadata)
- Test: `tests/design-tokens.test.mjs`

**Interfaces:**
- Produces: CSS variables `--background --foreground --card --card-foreground --popover --popover-foreground --primary --primary-foreground --secondary --secondary-foreground --muted --muted-foreground --accent --accent-foreground --destructive --success --warning --border --input --ring --brand-cherry --brand-orange --brand-amber --brand-ember --glow-hot --glass-inset --brand-gradient --brand-gradient-text --radius`.
- Tailwind classes: `bg-success text-success bg-warning text-warning text-brand-orange bg-brand-cherry rounded-field text-display glass glass-inset glass-raised bg-brand-gradient bg-brand-gradient-text`.
- CSS hooks used by Task 6: `.cp-glow[data-intensity="app"|"hero"] > .cp-glow-wash + .cp-glow-core` and `.cp-orb[data-state="idle"|"listening"|"thinking"|"speaking"]`.

- [ ] **Step 1: Write the failing test**

Create `tests/design-tokens.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test tests/design-tokens.test.mjs`
Expected: FAIL. `core tokens hold the spec values` reports `--background` as `oklch(1 0 0)`, and the dark-only test fails on the `.dark` block.

- [ ] **Step 3: Replace `src/app/globals.css`**

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-brand-cherry: var(--brand-cherry);
  --color-brand-orange: var(--brand-orange);
  --color-brand-amber: var(--brand-amber);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
  --radius-field: 10px;
  --text-display: 2rem;
  --text-display--line-height: 1.1;
  --text-display--letter-spacing: -0.03em;
  --text-display--font-weight: 600;
}

/* Dark only. <html> always has class "dark", so the kit's dark: variants apply. */
:root {
  color-scheme: dark;
  --background: #070505;
  --foreground: #f5f2f0;
  --card: rgb(255 255 255 / 3.5%);
  --card-foreground: #f5f2f0;
  --popover: rgb(24 16 16 / 85%);
  --popover-foreground: #f5f2f0;
  --primary: #ffffff;
  --primary-foreground: #1a0505;
  --secondary: rgb(255 255 255 / 6%);
  --secondary-foreground: #f5f2f0;
  --muted: rgb(255 255 255 / 6%);
  --muted-foreground: rgb(255 255 255 / 55%);
  --accent: rgb(255 255 255 / 6%);
  --accent-foreground: #f5f2f0;
  --destructive: #ff4d4d;
  --success: #34d399;
  --warning: #fbbf24;
  --border: rgb(255 255 255 / 10%);
  --input: rgb(255 255 255 / 12%);
  --ring: rgb(255 106 26 / 60%);
  --brand-cherry: #e1122b;
  --brand-orange: #ff6a1a;
  --brand-amber: #ffc08a;
  --brand-ember: #3a0508;
  --glow-hot: #fff1e6;
  --glass-inset: rgb(10 6 6 / 35%);
  --brand-gradient: linear-gradient(135deg, #ff6a1a, #e1122b);
  --brand-gradient-text: linear-gradient(135deg, #d9361a, #b80a1d);
  --chart-1: #ff6a1a;
  --chart-2: #e1122b;
  --chart-3: #ffc08a;
  --chart-4: #34d399;
  --chart-5: #fbbf24;
  --radius: 0.875rem;
  --sidebar: rgb(255 255 255 / 3.5%);
  --sidebar-foreground: #f5f2f0;
  --sidebar-primary: #ffffff;
  --sidebar-primary-foreground: #1a0505;
  --sidebar-accent: rgb(255 255 255 / 6%);
  --sidebar-accent-foreground: #f5f2f0;
  --sidebar-border: rgb(255 255 255 / 10%);
  --sidebar-ring: rgb(255 106 26 / 60%);
}

/* ---------- glass ---------- */

@utility glass {
  background-color: var(--card);
  border: 1px solid var(--border);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%), 0 10px 30px rgb(0 0 0 / 25%);
}

@utility glass-inset {
  background-color: var(--glass-inset);
  border: 1px solid var(--border);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

@utility glass-raised {
  background-color: var(--popover);
  border: 1px solid var(--border);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 8%), 0 20px 50px rgb(0 0 0 / 50%);
}

/* Decoration only. Never put text on it. */
@utility bg-brand-gradient {
  background-image: var(--brand-gradient);
}

/* For surfaces with white text: brand button, user chat bubble. */
@utility bg-brand-gradient-text {
  background-image: var(--brand-gradient-text);
}

/* ---------- glow: one fixed layer behind the page ---------- */

.cp-glow {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  opacity: 0.275;
}

.cp-glow[data-intensity="hero"] {
  opacity: 0.5;
}

.cp-glow-wash {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, var(--brand-ember) 0%, rgb(58 5 8 / 35%) 30%, transparent 60%);
}

.cp-glow-core {
  position: absolute;
  left: -15%;
  right: -15%;
  bottom: -35%;
  height: 90%;
  filter: blur(40px);
  /* app: hottest color is orange, so muted text over it stays at least 4.5:1 */
  background: radial-gradient(
    ellipse 75% 70% at 50% 100%,
    var(--brand-orange) 0%,
    var(--brand-cherry) 40%,
    rgb(140 8 24 / 55%) 62%,
    transparent 88%
  );
}

.cp-glow[data-intensity="hero"] .cp-glow-core {
  background: radial-gradient(
    ellipse 75% 70% at 50% 100%,
    var(--glow-hot) 0%,
    var(--brand-amber) 10%,
    var(--brand-orange) 26%,
    var(--brand-cherry) 46%,
    rgb(140 8 24 / 55%) 66%,
    transparent 88%
  );
}

/* ---------- orb ---------- */

.cp-orb {
  border-radius: 9999px;
  flex: none;
  background: radial-gradient(circle at 32% 26%, #ffffff 0%, #ffe7cc 7%, #ff9a4d 26%, var(--brand-cherry) 60%, #5a0610 92%);
  box-shadow:
    inset -10px -14px 26px rgb(60 0 8 / 55%),
    inset 6px 8px 16px rgb(255 255 255 / 25%),
    0 0 40px 6px rgb(255 90 40 / 30%);
}

.cp-orb[data-state="idle"] {
  filter: saturate(0.7) brightness(0.85);
  box-shadow: inset -10px -14px 26px rgb(60 0 8 / 55%), 0 0 20px 2px rgb(255 90 40 / 18%);
}

.cp-orb[data-state="listening"] {
  animation: cp-orb-breathe 1.6s ease-in-out infinite;
}

.cp-orb[data-state="thinking"] {
  background: conic-gradient(from 0deg, var(--brand-cherry), var(--brand-orange), var(--brand-amber), var(--brand-orange), var(--brand-cherry));
  mask: radial-gradient(circle, #000 64%, transparent 66%);
  animation: cp-orb-spin 2.4s linear infinite;
}

.cp-orb[data-state="speaking"] {
  animation: cp-orb-talk 0.45s ease-in-out infinite alternate;
}

@keyframes cp-orb-breathe {
  50% {
    transform: scale(1.07);
    box-shadow: 0 0 56px 10px rgb(255 90 40 / 42%);
  }
}

@keyframes cp-orb-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes cp-orb-talk {
  from {
    transform: scale(0.97);
  }
  to {
    transform: scale(1.06);
    box-shadow: 0 0 60px 12px rgb(255 90 40 / 45%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cp-orb {
    animation: none !important;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 4: Put `dark` on `<html>` in `src/app/layout.tsx`**

Change the `<html>` className and the description. Leave the rest of the file as it is.

```tsx
export const metadata: Metadata = {
  title: "Cherry Pick",
  description: "Find co-hosts for your next event.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node --test tests/design-tokens.test.mjs`
Expected: PASS, all 8 tests. If `white text on the text-safe brand gradient` fails, the stop colors were edited. Keep both stops at or below luminance 0.183.

- [ ] **Step 6: Check that it still builds**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx tests/design-tokens.test.mjs
git commit -m "feat: dark gradient-glass tokens, glass utilities, glow and orb styles

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Raw-color guard test

**Files:**
- Test: `tests/design-guard.test.mjs`

**Interfaces:**
- Produces: the `PENDING` set of not-yet-migrated files. PR 2's plan removes entries as it migrates pages, and must leave it empty.

- [ ] **Step 1: Write the test with an empty pending list**

Create `tests/design-guard.test.mjs`:

```js
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
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|shadow|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;
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
```

- [ ] **Step 2: Run it and capture today's offenders**

Run: `node --test tests/design-guard.test.mjs`
Expected: `detector catches raw colors…` PASS. `pages and components use design tokens…` FAIL, listing `path:line: match` entries. On `main` after PR #8, expect roughly `src/app/(app)/events/new/page.tsx`, `src/app/(app)/events/[id]/page.tsx`, `src/app/(app)/profile/profile-form.tsx`, `src/app/unsubscribe/page.tsx`, `src/components/assistant/thread.tsx` and `src/components/assistant/intent-card.tsx`. Use the exact list the run prints.

- [ ] **Step 3: Put each offending file path (once) into `PENDING`**

Example, which must match your run's output:

```js
const PENDING = new Set([
  "src/app/(app)/events/[id]/page.tsx",
  "src/app/(app)/events/new/page.tsx",
  "src/app/(app)/profile/profile-form.tsx",
  "src/app/unsubscribe/page.tsx",
  "src/components/assistant/intent-card.tsx",
  "src/components/assistant/thread.tsx",
]);
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `node --test tests/design-guard.test.mjs`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add tests/design-guard.test.mjs
git commit -m "test: guard pages against raw palette and hex colors

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Restyle the kit (button, alert, card, input)

**Files:**
- Modify: `src/components/ui/button.tsx` (replace the `buttonVariants` definition)
- Modify: `src/components/ui/alert.tsx` (replace the `alertVariants` definition)
- Modify: `src/components/ui/card.tsx` (3 class string edits)
- Modify: `src/components/ui/input.tsx` (replace the class string)

**Interfaces:**
- Consumes: `glass`, `glass-inset`, `bg-brand-gradient-text`, `rounded-field`, `bg-success`, `text-warning` from Task 2.
- Produces: `<Button variant="default"|"brand"|"outline"|"secondary"|"ghost"|"destructive"|"link" size="default"|"xs"|"sm"|"lg"|"icon"|"icon-xs"|"icon-sm"|"icon-lg">` and `<Alert variant="default"|"destructive"|"success"|"warning">`. `Card` and `Input` keep their props.

These are class-only edits with no logic, so they're checked by type-checking, lint and the `/design` page (Task 7) rather than unit tests.

- [ ] **Step 1: Replace `buttonVariants` in `src/components/ui/button.tsx`**

Keep the imports and the `Button` function. Replace the `const buttonVariants = cva(…)` block with:

```tsx
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-full border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        brand:
          "bg-brand-gradient-text text-primary shadow-[0_0_16px_rgb(255_80_40/0.4),inset_0_1px_0_rgb(255_255_255/0.25)] hover:brightness-110",
        outline:
          "border-border bg-secondary text-foreground hover:bg-foreground/10 aria-expanded:bg-foreground/10",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-foreground/10 aria-expanded:bg-secondary",
        ghost:
          "text-foreground/80 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        destructive:
          "border-destructive/40 bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:border-destructive/40 focus-visible:ring-destructive/30",
        link: "text-foreground underline underline-offset-4 hover:text-foreground/80",
      },
      size: {
        default: "h-9 gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xs: "h-6 gap-1 px-2.5 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
```

- [ ] **Step 2: Replace `alertVariants` in `src/components/ui/alert.tsx`**

```tsx
const alertVariants = cva(
  "group/alert relative grid w-full gap-0.5 rounded-field border px-3 py-2.5 text-left text-sm has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        destructive:
          "border-destructive/30 bg-destructive/10 text-destructive *:data-[slot=alert-description]:text-destructive/90",
        success:
          "border-success/30 bg-success/10 text-success *:data-[slot=alert-description]:text-success/90",
        warning:
          "border-warning/30 bg-warning/10 text-warning *:data-[slot=alert-description]:text-warning/90",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 3: Make `Card` glass in `src/components/ui/card.tsx`**

Make three exact replacements:

1. In `Card`, replace `rounded-xl bg-card py-(--card-spacing) text-sm text-card-foreground ring-1 ring-foreground/10` with `rounded-lg glass py-(--card-spacing) text-sm text-card-foreground`.
2. In `Card`, replace `*:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl` with `*:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg`.
3. In `CardHeader`, replace `rounded-t-xl` with `rounded-t-lg`. In `CardFooter`, replace `rounded-b-xl border-t bg-muted/50` with `rounded-b-lg border-t bg-foreground/[0.03]`.

- [ ] **Step 4: Make `Input` an inset glass field in `src/components/ui/input.tsx`**

Replace the `cn(` first argument with:

```tsx
"h-9 w-full min-w-0 rounded-field glass-inset px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/60 aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
```

- [ ] **Step 5: Type-check, lint and test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no type or lint errors. All tests pass, including the existing outreach, partners, profile and publish suites.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/alert.tsx src/components/ui/card.tsx src/components/ui/input.tsx
git commit -m "feat: glass kit components, brand button, success and warning alerts

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Logo files, `Logo` component, favicon

**Files:**
- Create: `public/brand/lockup-white.png`, `public/brand/lockup-color.png`, `public/brand/mark.png` (copied)
- Create: `src/app/icon.png` (copied)
- Delete: `src/app/favicon.ico` (the Next.js default; `icon.png` replaces it)
- Create: `src/components/brand/logo.tsx`

**Interfaces:**
- Produces: `Logo({ variant?: "full" | "mark"; tone?: "white" | "color"; height?: number; className?: string })`. Defaults are `variant="full"`, `tone="white"`, `height=22`. `tone` only affects `full`.

- [ ] **Step 1: Copy the prepared files**

```bash
mkdir -p public/brand
cp docs/superpowers/specs/assets/brand-lockup-white.png public/brand/lockup-white.png
cp docs/superpowers/specs/assets/brand-lockup-color.png public/brand/lockup-color.png
cp docs/superpowers/specs/assets/brand-mark.png public/brand/mark.png
cp docs/superpowers/specs/assets/brand-mark.png src/app/icon.png
git rm src/app/favicon.ico
```

The lockups are 1200×271 and the mark is 512×512, all with transparent backgrounds.

- [ ] **Step 2: Read the app-icon convention**

Run: `sed -n 1,60p node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/app-icons.md`
Confirm `icon.png` in `app/` produces `<link rel="icon">`.

- [ ] **Step 3: Write `src/components/brand/logo.tsx`**

```tsx
import Image from "next/image";

const LOCKUP = {
  white: { src: "/brand/lockup-white.png", width: 1200, height: 271 },
  color: { src: "/brand/lockup-color.png", width: 1200, height: 271 },
} as const;
const MARK = { src: "/brand/mark.png", width: 512, height: 512 } as const;

type LogoProps = {
  variant?: "full" | "mark";
  /** full only: white on dark surfaces (default), color only on white backgrounds. */
  tone?: "white" | "color";
  /** Rendered height in px. Width follows the artwork's ratio. */
  height?: number;
  className?: string;
};

export function Logo({ variant = "full", tone = "white", height = 22, className }: LogoProps) {
  const art = variant === "mark" ? MARK : LOCKUP[tone];
  return (
    <Image
      src={art.src}
      alt="cherrypick"
      height={height}
      width={Math.round((art.width / art.height) * height)}
      className={className}
    />
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add public/brand src/app/icon.png src/components/brand/logo.tsx
git commit -m "feat: cherrypick logo component, brand files and favicon

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `Glow` and `Orb`

**Files:**
- Create: `src/components/brand/orb-state.ts`
- Create: `src/components/brand/orb.tsx`
- Create: `src/components/brand/glow.tsx`
- Test: `tests/orb-state.test.mjs`

**Interfaces:**
- Consumes: `.cp-glow*` and `.cp-orb[data-state]` CSS from Task 2, and `cn` from `@/lib/utils`.
- Produces:
  - `ORB_STATES: readonly ["idle","listening","thinking","speaking"]`, `type OrbState`, `toOrbState(value: unknown): OrbState` (unknown → `"idle"`), `orbLabel(state: OrbState): string`.
  - `Orb({ state?: unknown; size?: number; className?: string })`, where `size` is px and defaults to 72.
  - `Glow({ intensity?: "app" | "hero" })`, which defaults to `"app"`.

- [ ] **Step 1: Write the failing test**

Create `tests/orb-state.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/orb-state.test.mjs`
Expected: FAIL with `Cannot find module …/orb-state.ts`.

- [ ] **Step 3: Write `src/components/brand/orb-state.ts`**

```ts
export const ORB_STATES = ["idle", "listening", "thinking", "speaking"] as const;

export type OrbState = (typeof ORB_STATES)[number];

const LABELS: Record<OrbState, string> = {
  idle: "Voice idle",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

/** Voice events arrive as loose strings; anything unrecognized shows the idle orb. */
export function toOrbState(value: unknown): OrbState {
  return typeof value === "string" && (ORB_STATES as readonly string[]).includes(value)
    ? (value as OrbState)
    : "idle";
}

export function orbLabel(state: OrbState): string {
  return LABELS[state];
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `node --test tests/orb-state.test.mjs`
Expected: PASS, all 3 tests.

- [ ] **Step 5: Write `src/components/brand/orb.tsx`**

```tsx
import { cn } from "@/lib/utils";
import { orbLabel, toOrbState } from "./orb-state";

type OrbProps = {
  /** Set by the voice feature. Unknown values render the idle orb. */
  state?: unknown;
  /** Diameter in px. */
  size?: number;
  className?: string;
};

export function Orb({ state, size = 72, className }: OrbProps) {
  const s = toOrbState(state);
  return (
    <div
      role="img"
      aria-label={orbLabel(s)}
      data-state={s}
      className={cn("cp-orb", className)}
      style={{ width: size, height: size }}
    />
  );
}
```

- [ ] **Step 6: Write `src/components/brand/glow.tsx`**

```tsx
type GlowProps = {
  /** app: signed-in pages (27.5%). hero: login, onboarding, empty states (50%). */
  intensity?: "app" | "hero";
};

/** One fixed glow behind the page. Put page content in a `relative z-10` wrapper above it. */
export function Glow({ intensity = "app" }: GlowProps) {
  return (
    <div aria-hidden="true" data-intensity={intensity} className="cp-glow">
      <div className="cp-glow-wash" />
      <div className="cp-glow-core" />
    </div>
  );
}
```

- [ ] **Step 7: Type-check, lint and test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors, and all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/brand/orb-state.ts src/components/brand/orb.tsx src/components/brand/glow.tsx tests/orb-state.test.mjs
git commit -m "feat: Glow backdrop and voice Orb with safe state fallback

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `PageHeader`, `EmptyState` and the `/design` reference page

**Files:**
- Create: `src/components/brand/page-header.tsx`
- Create: `src/components/brand/empty-state.tsx`
- Create: `src/app/design/page.tsx`

**Interfaces:**
- Consumes: `Logo`, `Glow`, `Orb`, `ORB_STATES` (Tasks 5–6), plus `Button`, `Alert`/`AlertTitle`/`AlertDescription`, `Card`/`CardHeader`/`CardTitle`/`CardDescription`/`CardContent`, `Input` and `Label` (kit, Task 4).
- Produces: `PageHeader({ title: string; description?: string; actions?: React.ReactNode })` and `EmptyState({ title: string; description?: string; action?: React.ReactNode })`. `/design` returns 404 when `NODE_ENV === "production"`.

- [ ] **Step 1: Read the `notFound` doc**

Run: `sed -n 1,40p node_modules/next/dist/docs/01-app/03-api-reference/04-functions/not-found.md`
Confirm it is called in the render path of a Server Component.

- [ ] **Step 2: Write `src/components/brand/page-header.tsx`**

```tsx
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
```

- [ ] **Step 3: Write `src/components/brand/empty-state.tsx`**

```tsx
import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="glass grid justify-items-center gap-3 rounded-lg px-6 py-12 text-center">
      <h2 className="text-lg font-semibold tracking-tight text-balance">{title}</h2>
      {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/app/design/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/brand/empty-state";
import { Glow } from "@/components/brand/glow";
import { Logo } from "@/components/brand/logo";
import { Orb } from "@/components/brand/orb";
import { ORB_STATES } from "@/components/brand/orb-state";
import { PageHeader } from "@/components/brand/page-header";

const SWATCHES = [
  ["Background", "bg-background"],
  ["Foreground", "bg-foreground"],
  ["Glass fill", "bg-card"],
  ["Primary", "bg-primary"],
  ["Brand gradient", "bg-brand-gradient"],
  ["Brand gradient (text)", "bg-brand-gradient-text"],
  ["Cherry", "bg-brand-cherry"],
  ["Orange", "bg-brand-orange"],
  ["Amber", "bg-brand-amber"],
  ["Destructive", "bg-destructive"],
  ["Success", "bg-success"],
  ["Warning", "bg-warning"],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4">
      <h2 className="font-mono text-xs tracking-[0.12em] text-brand-orange uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <Glow intensity="app" />
      <main className="relative z-10 mx-auto grid w-full max-w-5xl gap-12 px-6 py-10">
        <PageHeader
          title="Design system"
          description="Every token and component in one place. Dev only."
          actions={<Logo height={22} />}
        />

        <Section title="Logo">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="glass grid h-32 place-items-center rounded-lg"><Logo height={28} /></div>
            <div className="grid h-32 place-items-center rounded-lg bg-primary"><Logo tone="color" height={28} /></div>
            <div className="glass flex h-32 items-end justify-center gap-4 rounded-lg pb-8">
              <Logo variant="mark" height={16} />
              <Logo variant="mark" height={32} />
              <Logo variant="mark" height={64} />
            </div>
          </div>
        </Section>

        <Section title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SWATCHES.map(([name, cls]) => (
              <div key={name} className="grid gap-2">
                <div className={`h-14 rounded-field border border-border ${cls}`} />
                <span className="text-xs text-muted-foreground">{name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Glass">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="glass rounded-lg p-4 text-sm">glass · panels, cards, top bar</div>
            <div className="glass-inset rounded-field p-4 text-sm">glass-inset · inputs, composer</div>
            <div className="glass-raised rounded-lg p-4 text-sm">glass-raised · menus, dialogs</div>
          </div>
        </Section>

        <Section title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Save changes</Button>
            <Button variant="brand">✦ Find co-hosts</Button>
            <Button variant="outline">Preview</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Remove co-host</Button>
            <Button variant="link">View on Luma</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Section>

        <Section title="Form and alerts">
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Company profile</CardTitle>
                <CardDescription>Example values.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="design-city">City</Label>
                  <Input id="design-city" defaultValue="San Francisco" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="design-cap">Venue capacity</Label>
                  <Input id="design-cap" defaultValue="-20" aria-invalid="true" />
                  <p className="text-xs text-destructive">Capacity must be above 0.</p>
                </div>
              </CardContent>
            </Card>
            <div className="grid content-start gap-3">
              <Alert variant="success"><AlertTitle>Invites sent</AlertTitle><AlertDescription>3 companies were invited.</AlertDescription></Alert>
              <Alert variant="warning"><AlertTitle>2 credits left</AlertTitle><AlertDescription>Searches stop at 0.</AlertDescription></Alert>
              <Alert variant="destructive"><AlertTitle>Payment failed</AlertTitle><AlertDescription>Card declined. Try another card.</AlertDescription></Alert>
              <Alert><AlertTitle>Draft saved</AlertTitle><AlertDescription>Nothing was sent.</AlertDescription></Alert>
            </div>
          </div>
        </Section>

        <Section title="Voice orb">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ORB_STATES.map((s) => (
              <div key={s} className="glass grid justify-items-center gap-3 rounded-lg py-6">
                <Orb state={s} />
                <code className="font-mono text-xs text-muted-foreground">{s}</code>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Empty state">
          <EmptyState
            title="No events yet"
            description="Describe your event and we'll find companies to co-host it."
            action={<Button variant="brand">+ New event</Button>}
          />
        </Section>
      </main>
    </>
  );
}
```

- [ ] **Step 5: Type-check, lint and test**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no errors. All tests pass, and the guard test stays green because `src/app/design/page.tsx` uses tokens only.

- [ ] **Step 6: Look at it**

Run: `npm run dev` (in the background), then open http://localhost:3000/design.
Expected:
- A black page with a soft orange-red glow rising from the bottom.
- The white logo, and 12 swatches.
- Pill buttons: white "Save changes", a deep orange-red "Find co-hosts" with a glow, a red-tinted "Remove co-host".
- Frosted card and inputs; the invalid input has a red border.
- Four alerts in green, amber, red and neutral.
- Four orbs: idle is dim, listening breathes, thinking spins as a ring, speaking pulses.
- The favicon tab shows the red cherry.

Take one screenshot for the PR (`/design` at 1440×900).

- [ ] **Step 7: Commit**

```bash
git add src/components/brand/page-header.tsx src/components/brand/empty-state.tsx src/app/design/page.tsx
git commit -m "feat: PageHeader, EmptyState and dev-only /design reference page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Team rules, production check, PR

**Files:**
- Modify: `AGENTS.md` (append a section after "Safe to change")

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Append the UI rules to `AGENTS.md`**

```markdown
# Cherry Pick UI rules

The design system lives in `src/app/globals.css` (tokens), `src/components/ui/` (shadcn kit) and `src/components/brand/` (Logo, Glow, Orb, PageHeader, EmptyState). Run `npm run dev` and open `/design` to see every piece. Spec: `docs/superpowers/specs/2026-10-03-design-system-design.md`.

- Use tokens only: `bg-primary`, `text-muted-foreground`, `border-border`, `bg-success`, and so on. No `zinc-*`, `red-*` or hex colors in pages. `tests/design-guard.test.mjs` fails on them.
- White (`<Button>`) is the everyday primary action. `<Button variant="brand">` is only for AI and brand actions (find co-hosts, voice, publish). Red (`variant="destructive"`) only for actions that lose something.
- Panels and cards use `glass`, inputs use `glass-inset`, menus and dialogs use `glass-raised`.
- Never put text on `bg-brand-gradient`. Use `bg-brand-gradient-text` for anything with white text.
- One `<Glow>` per page, behind a `relative z-10` content wrapper. `intensity="app"` for signed-in pages, `"hero"` for login, onboarding and empty states.
- The voice feature sets `<Orb state>` only. Don't restyle the orb in feature code.
- Dark only, desktop only.
```

- [ ] **Step 2: Confirm `/design` is hidden in production**

```bash
npm run build && (npx next start -p 3100 & echo $! > /tmp/cp-next.pid) && sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3100/design
kill "$(cat /tmp/cp-next.pid)"
```

Expected: `404`. If `npm run build` fails on missing env vars that have nothing to do with this branch, copy `.env.example` to `.env.local` with placeholder values and rerun. Don't commit `.env.local`.

- [ ] **Step 3: Run the full check once**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: all green.

- [ ] **Step 4: Commit and push**

```bash
git add AGENTS.md
git commit -m "docs: UI rules for the design system

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
git push -u origin abidanalyze/design-system-foundations
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --base main --title "Design system foundations (PR 1 of 4)" --body "$(cat <<'EOF'
## What

Foundation of the Cherry Pick dark gradient-glass design system:
- Dark-only tokens on the shadcn variable names, plus brand, success and warning tokens
- `glass`, `glass-inset`, `glass-raised` utilities. Glow backdrop (app 27.5%, hero 50%) and voice Orb (idle, listening, thinking, speaking)
- Restyled kit: pill buttons with a `brand` variant, success and warning alerts, glass card, inset input
- Logo (white and color lockups, red cherry mark) and a new favicon
- Dev-only `/design` reference page (404 in production)
- Tests: token values and contrast math, raw-color guard (with a pending list that PR 2 empties), orb state fallback
- UI rules in AGENTS.md

Spec: `docs/superpowers/specs/2026-10-03-design-system-design.md`
Visual reference: https://claude.ai/artifact/5F9SrBYyk3SYRip2oqJG1S

## Not in this PR

Page migrations and the top bar (PR 2), chat and voice (PR 3), invite email (PR 4).

## Screenshot

(attach the /design screenshot from Task 7)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: a PR URL.
