# Design System Pages (PR 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every screen of Cherry Pick on the design system: the floating glass top bar, the glow behind every page, hero styling on sign-in, and token colors in all 29 files still using raw Tailwind palette classes. The guard's `PENDING` list ends empty.

**Architecture:** Mechanical and test-gated. Each task removes its files from `PENDING` in `tests/design-guard.test.mjs` (RED: the guard lists them), converts them with the fixed mapping table below (GREEN). New pieces: a route-aware `RouteGlow` (pure `glowIntensityFor` is unit tested) and a restyled `SiteNav`/`NavLinks` as the glass pill. No logic, data or copy changes.

**Tech Stack:** Next.js 16.3, React 19, Tailwind v4, the PR 1 tokens and utilities (`glass`, `glass-inset`, `glass-raised`, `above-glow`, `bg-brand-gradient-text`), `Glow`, `Logo`, `buttonVariants`.

**Spec:** `docs/superpowers/specs/2026-10-03-design-system-design.md` (sections "App layout and page moves", "Color roles", "Glow"). Builds on PR 1 (`docs/superpowers/plans/2026-10-03-design-system-foundations.md`, PR #14).

## Global Constraints

- Stacked on PR 1: branch `abidanalyze/design-system-pages` from `abidanalyze/design-system-foundations`. The PR targets that branch until PR #14 merges, then it is retargeted to `main`.
- Change classes only. Do not change data fetching, server actions, copy, element structure, ids, `aria-*` or `role`. The two exceptions are the top bar (Task 2) and the hero pages (Task 3), which this plan spells out.
- Dark only: drop every `dark:` variant while converting; keep only the token class.
- Run Next with Node 24: `PATH=/opt/homebrew/opt/node@24/bin:$PATH`. Typecheck = `npx next typegen && npx tsc --noEmit`.
- Text contrast at least 4.5:1. No body text over the hero glow's bottom 30% of the screen.
- Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Mapping table (used by Tasks 4–7)

Apply top to bottom; first match wins. "→ (drop)" means delete the class.

| Raw classes (any `hover:`/`focus:` prefix kept as is) | Token classes |
|---|---|
| `dark:*` anything | → (drop) |
| `bg-zinc-900 text-white` (hand-made primary button or active pill) | `bg-primary text-primary-foreground hover:bg-primary/90` |
| `text-zinc-500`, `text-zinc-600`, `text-zinc-400`, `text-zinc-700` | `text-muted-foreground` |
| `text-zinc-900`, `text-zinc-100`, `text-zinc-200`, `text-black` | `text-foreground` |
| `text-red-600`, `text-red-800` | `text-destructive` |
| `text-amber-700`, `text-amber-800`, `text-amber-900` | `text-warning` |
| `text-emerald-900` | `text-success` |
| `text-white` on a brand/gradient surface | `text-primary` |
| `border-zinc-100`, `border-zinc-200`, `border-zinc-300`, `border-zinc-700`, `border-zinc-800` | `border-border` |
| `focus:border-zinc-500` | `focus:border-ring` |
| `divide-zinc-100`, `divide-zinc-800/60` | `divide-border` |
| `rounded-xl border border-zinc-200` on a list or card container | `glass rounded-lg` (glass brings its own border) |
| `bg-white`, `bg-black`, `bg-zinc-50`, `bg-zinc-950` as a panel or card background | `glass` |
| `bg-white/95`, `bg-white/80` floating bars, `bg-white` in `<dialog>` | `glass-raised` |
| `backdrop:bg-black/40` | `backdrop:bg-background/70` |
| `bg-zinc-100`, `bg-zinc-200`, `bg-zinc-800` (chips, skeletons) | `bg-muted` |
| `hover:bg-zinc-50`, `hover:bg-zinc-100`, `hover:bg-zinc-900`, `hover:bg-zinc-900/60` | `hover:bg-muted` |
| `bg-white/20` (badge inside the active pill) | `bg-foreground/20` |
| `bg-amber-50`/`bg-amber-100` + `border-amber-200` + `text-amber-*` (notice box or chip) | `border-warning/30 bg-warning/10 text-warning` (box) or `bg-warning/15 text-warning` (chip) |
| `bg-emerald-100 text-emerald-900` (chip) | `bg-success/15 text-success` |
| `bg-red-100 text-red-800` (chip) | `bg-destructive/15 text-destructive` |
| `bg-red-400`, `bg-red-500` (voice recording dot) | `bg-brand-cherry` |
| `has-checked:border-zinc-900 has-checked:bg-zinc-100` | `has-checked:border-ring has-checked:bg-foreground/10` |
| Hand-made text input, select or textarea: `border border-zinc-300 … bg-transparent … focus:border-zinc-500` | `glass-inset rounded-field focus:border-ring focus:outline-none` (keep sizing and padding classes) |
| Secondary hand-made button: `border border-zinc-300` + hover | `border border-border bg-secondary hover:bg-foreground/10` |

Anything a file uses that the table doesn't cover: pick the nearest token by role (text, surface, border, state) and add a `Ruling:` line to the ledger.

## Review Focus

1. **Signed-out visitors and the top bar.** Login, `/browse` and the OAuth consent page must render the logo-only bar without errors when `getClaims()` returns no user.
2. **Long forms over the hero glow.** Onboarding is a long form, so it uses the app glow, not the hero glow (pinned by `glowIntensityFor` tests).
3. **Status chips stay distinguishable.** Pending, accepted/applied, declined, approved and rejected must still look different from each other after conversion (Task 4 maps each one explicitly).
4. **Dialogs and the sticky selection bar in the matches table** must stay readable over the page and the glow (`glass-raised`, not `glass`).
5. **A stray `bg-white`/`text-black` left behind.** The guard must catch black/white palette classes too (Task 1).

---

### Task 1: Branch and teach the guard about black and white

**Files:**
- Modify: `tests/design-guard.test.mjs`

**Interfaces:**
- Produces: a `PALETTE` regex that also flags `bg-white`, `text-black`, `bg-black/40` and similar. `PENDING` stays as is (29 files).

- [ ] **Step 1: Branch from PR 1**

```bash
cd /Volumes/Work/cherry-pick-design
git switch abidanalyze/design-system-foundations && git pull --ff-only
git switch -c abidanalyze/design-system-pages
```

- [ ] **Step 2: Add failing detector cases**

In `tests/design-guard.test.mjs`, test `detector catches raw colors and ignores tokens`, add:

```js
  assert.equal(rawColors('<div className="bg-white p-4">').length, 1);
  assert.equal(rawColors('<p className="text-black">').length, 1);
  assert.equal(rawColors('<dialog className="backdrop:bg-black/40">').length, 1);
  assert.equal(rawColors('<p className="bg-white/95">').length, 1);
  assert.equal(rawColors('<p className="text-primary-foreground bg-foreground/20">').length, 0);
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `node --test tests/design-guard.test.mjs`
Expected: FAIL in `detector catches raw colors…` (the `bg-white` case returns 0).

- [ ] **Step 4: Extend `PALETTE`**

Replace the `PALETTE` constant with:

```js
const PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|fill|stroke|outline|divide|placeholder|shadow|decoration|accent|caret)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|(?:black|white)(?![\w-]))/;
```

- [ ] **Step 5: Run it and confirm it passes**

Run: `node --test tests/design-guard.test.mjs`
Expected: PASS, 3/3. If `pages and components use design tokens…` now lists a file outside `PENDING`, convert that file with the mapping table in this task.

- [ ] **Step 6: Commit**

```bash
git add tests/design-guard.test.mjs
git commit -m "test: design guard also flags black and white palette classes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Glass top bar and route-aware glow

**Files:**
- Create: `src/components/brand/glow-route.ts`, `src/components/brand/route-glow.tsx`
- Modify: `src/components/site-nav.tsx`, `src/components/nav-links.tsx`, `src/app/layout.tsx`
- Modify: `tests/design-guard.test.mjs` (remove `src/components/site-nav.tsx` and `src/components/nav-links.tsx` from `PENDING`)
- Test: `tests/glow-route.test.mjs`

**Interfaces:**
- Consumes: `Glow` (`@/components/brand/glow`), `Logo` (`@/components/brand/logo`), `buttonVariants` (`@/components/ui/button`), `above-glow`.
- Produces: `glowIntensityFor(pathname: string): "app" | "hero"` and `RouteGlow()`.

- [ ] **Step 1: Write the failing test**

Create `tests/glow-route.test.mjs`:

```js
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `node --test tests/glow-route.test.mjs`
Expected: FAIL with `Cannot find module …/glow-route.ts`.

- [ ] **Step 3: Write `src/components/brand/glow-route.ts`**

```ts
// Onboarding is a long form that scrolls over the bottom of the screen, so it keeps
// the app glow: muted text on glass over the hero glow's white core drops below 4.5:1.
const HERO_PREFIXES = ["/login", "/oauth"];

export function glowIntensityFor(pathname: string): "app" | "hero" {
  return HERO_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ? "hero" : "app";
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `node --test tests/glow-route.test.mjs`
Expected: PASS, 3/3.

- [ ] **Step 5: Write `src/components/brand/route-glow.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { Glow } from "./glow";
import { glowIntensityFor } from "./glow-route";

/** The one glow for the whole app; hero screens get the stronger one. */
export function RouteGlow() {
  return <Glow intensity={glowIntensityFor(usePathname() ?? "/")} />;
}
```

- [ ] **Step 6: Remove the two nav files from `PENDING` and watch the guard fail**

Delete the `"src/components/nav-links.tsx",` and `"src/components/site-nav.tsx",` lines from `PENDING`.
Run: `node --test tests/design-guard.test.mjs`
Expected: FAIL, listing lines in `nav-links.tsx` and `site-nav.tsx`.

- [ ] **Step 7: Make the top bar a floating glass pill**

In `src/components/site-nav.tsx`:
- Keep the data loading.
- Remove the `{ href: "/events/new", label: "Plan an event" }` item, because it becomes the button.
- Replace the returned JSX and imports with:

```tsx
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { NavLinks, type NavItem } from "./nav-links";
```

```tsx
  return (
    <header className="sticky top-3 z-10 px-4">
      <nav
        aria-label="Main"
        className="glass mx-auto flex w-full max-w-5xl items-center gap-3 rounded-full py-1.5 pr-1.5 pl-4 font-sans text-sm"
      >
        <Link href="/" aria-label="cherrypick home" className="shrink-0">
          <Logo height={20} />
        </Link>
        {items && (
          <>
            <div className="mx-auto">
              <NavLinks items={items} />
            </div>
            <Link href="/events/new" className={buttonVariants({ variant: "brand", size: "sm" })}>
              + New event
            </Link>
            <form action={signOut}>
              <button className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                Sign out
              </button>
            </form>
          </>
        )}
      </nav>
    </header>
  );
```

The items array becomes `Events`, `Browse`, `Inbox`, `Agents`, `{profile name}`. Signed-out visitors see the logo only.

- [ ] **Step 8: Restyle `NavLinks` in `src/components/nav-links.tsx`**

Replace the link and badge class expressions:

```tsx
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? "bg-foreground/10 text-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
```

```tsx
                  className={`rounded-full px-1.5 text-xs font-medium ${
                    active ? "bg-foreground/20" : "bg-warning/15 text-warning"
                  }`}
```

- [ ] **Step 9: Put the glow and the content layer in the root layout**

In `src/app/layout.tsx`, add `import { RouteGlow } from "@/components/brand/route-glow";` and make the body:

```tsx
      <body className="min-h-full flex flex-col">
        <RouteGlow />
        <SiteNav />
        <div className="above-glow flex flex-1 flex-col">{children}</div>
      </body>
```

Then in `src/app/design/page.tsx`, delete `<Glow intensity="app" />`, the surrounding `<>…</>` fragment and the `Glow` import, and change `className="above-glow mx-auto` to `className="mx-auto`. The layout now owns both.

- [ ] **Step 10: Run all checks**

Run: `npm test && npx next typegen && npx tsc --noEmit && npm run lint`
Expected: all green, including the guard with 27 files in `PENDING`.

- [ ] **Step 11: Look at it**

Run the dev server (Node 24) on port 3200 and open `/design` and `/login`.
Expected:
- A glass pill floats at the top. Signed out it shows the logo only.
- `/design` has the faint app glow.
- `/login` has the strong hero glow.
- Scrolling `/design` slides content under the pill, not over it.

- [ ] **Step 12: Commit**

```bash
git add src/components/brand/glow-route.ts src/components/brand/route-glow.tsx src/components/site-nav.tsx src/components/nav-links.tsx src/app/layout.tsx src/app/design/page.tsx tests/glow-route.test.mjs tests/design-guard.test.mjs
git commit -m "feat: floating glass top bar and route-aware glow

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Hero sign-in and agent consent

**Files:**
- Modify: `src/app/login/page.tsx`, `src/app/oauth/consent/page.tsx`
- Modify: `tests/design-guard.test.mjs` (remove `src/app/oauth/consent/page.tsx` from `PENDING`)

**Interfaces:**
- Consumes: `text-display`, `text-brand-orange`, kit `Card` (already glass).

- [ ] **Step 1: Remove the consent page from `PENDING` and watch the guard fail**

Run: `node --test tests/design-guard.test.mjs`
Expected: FAIL listing `src/app/oauth/consent/page.tsx` lines.

- [ ] **Step 2: Login hero**

In `src/app/login/page.tsx`, replace the returned `<main>` with:

```tsx
    <main className="flex flex-1 flex-col items-center px-4 pt-[10vh] pb-[30vh]">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-display text-balance">
            Find your next <span className="text-brand-orange">co-host</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in or create an account to get started.
          </p>
        </div>
        <LoginForm nextPath={nextPath ?? undefined} />
      </div>
    </main>
```

`pb-[30vh]` keeps the form above the hero glow's white core (spec: no body text over the bottom of the hero glow).

- [ ] **Step 3: Consent page**

Convert `src/app/oauth/consent/page.tsx` with the mapping table. Give its outer `<main>` the same `pt-[10vh] pb-[30vh]` vertical spacing as login, and make its card container `glass rounded-lg`.

- [ ] **Step 4: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all green, with 26 files in `PENDING`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/oauth/consent/page.tsx tests/design-guard.test.mjs
git commit -m "feat: hero sign-in and agent consent screens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Events, matches and invites

**Files (all Modify, all removed from `PENDING` in Step 1):**
`src/app/(app)/page.tsx`, `src/app/(app)/events/[id]/page.tsx`, `src/app/(app)/events/[id]/loading.tsx`, `src/app/(app)/events/[id]/find-matches-button.tsx`, `src/components/events/matches-table.tsx`, `src/components/events/incoming-applications.tsx`, `src/components/events/approval-queue.tsx`, `src/components/events/invite-list.tsx`, `src/components/events/invite-status.tsx`

- [ ] **Step 1: Remove the 9 files from `PENDING` and watch the guard fail**

Run: `node --test tests/design-guard.test.mjs`
Expected: FAIL listing lines in exactly these 9 files.

- [ ] **Step 2: Status chips (`invite-status.tsx`)**

Replace `STYLES` with:

```ts
const STYLES: Record<InviteStatus, string> = {
  pending: "bg-muted text-foreground",
  accepted: "bg-warning/15 text-warning",
  applied: "bg-warning/15 text-warning",
  declined: "bg-muted text-muted-foreground",
  approved: "bg-success/15 text-success",
  rejected: "bg-destructive/15 text-destructive",
};
```

- [ ] **Step 3: Convert the other 8 files with the mapping table**

Specific cases:
- Events home: the "Plan an event" link becomes `buttonVariants()` (white primary), imported from `@/components/ui/button`. The events list becomes `glass rounded-lg divide-y divide-border`.
- `matches-table.tsx`:
  - The sticky selection bar becomes `glass-raised` with `rounded-full`.
  - The `<dialog>` becomes `glass-raised text-foreground backdrop:bg-background/70`.
  - The amber warning list uses `text-warning`.
  - The main "send" action stays white primary.
- `find-matches-button.tsx`: the amber notice box becomes `rounded-field border border-warning/30 bg-warning/10 text-warning`. "Find matches" is an AI action, so its button uses `buttonVariants({ variant: "brand" })` (spec: the gradient is for AI and brand actions).
- `loading.tsx` skeletons: `bg-muted animate-pulse`, same shapes.

- [ ] **Step 4: Checks**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all green, with 17 files in `PENDING`.

- [ ] **Step 5: Commit**

```bash
git add -A src/app/'(app)'/page.tsx src/app/'(app)'/events src/components/events tests/design-guard.test.mjs
git commit -m "feat: events, matches and invites on the design system

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Inbox and company profile

**Files (Modify, removed from `PENDING`):**
`src/app/(app)/inbox/page.tsx`, `src/app/(app)/inbox/loading.tsx`, `src/app/(app)/inbox/respond-form.tsx`, `src/app/(app)/profile/profile-form.tsx`

- [ ] **Step 1: Remove the 4 files from `PENDING`. Expect the guard to FAIL on exactly them.**
- [ ] **Step 2: Convert them with the mapping table.**
  - In `profile-form.tsx`, the amenity and weekday checkbox chips use the `has-checked:` row, inputs use the input row, and the submit button is white primary.
  - In `respond-form.tsx`, Accept is white primary and Decline is the secondary button row.
- [ ] **Step 3: Run `npm test && npx tsc --noEmit && npm run lint`. Expect all green, with 13 files in `PENDING`.**
- [ ] **Step 4: Commit** `feat: inbox and company profile on the design system` (with the trailer).

---

### Task 6: Agents, browse, approvals (MCP pages)

**Files (Modify, removed from `PENDING`):**
`src/app/agents/page.tsx`, `src/app/approvals/[id]/page.tsx`, `src/app/approvals/[id]/decide-form.tsx`, `src/app/browse/page.tsx`, `src/app/browse/apply-form.tsx`, `src/app/settings/agents/page.tsx`, `src/app/settings/agents/issue-token-form.tsx`, `src/components/approvals/approval-card.tsx`, `src/components/copy-block.tsx`

- [ ] **Step 1: Remove the 9 files from `PENDING`. Expect the guard to FAIL on exactly them.**
- [ ] **Step 2: Convert them with the mapping table.**
  - `copy-block.tsx`: code and token blocks use `glass-inset rounded-field font-mono`.
  - Approve and decline buttons follow Task 5's Accept/Decline mapping.
- [ ] **Step 3: Run `npm test && npx tsc --noEmit && npm run lint`. Expect all green, with 4 files in `PENDING`.**
- [ ] **Step 4: Commit** `feat: agent, browse and approval screens on the design system` (with the trailer).

---

### Task 7: Chat and voice (colors only)

**Files (Modify, removed from `PENDING`):**
`src/components/assistant/thread.tsx`, `src/components/assistant/intent-card.tsx`, `src/components/assistant/intake.tsx`, `src/components/assistant/voice-chat.tsx`

PR 3 redesigns the chat (bubble shapes, Orb wiring). This task only swaps colors so `PENDING` empties.

- [ ] **Step 1: Remove the 4 files from `PENDING`, leaving it as `new Set([])`. Expect the guard to FAIL on exactly them.**
- [ ] **Step 2: Convert them with the mapping table.**
  - The user's own message bubble becomes `bg-brand-gradient-text text-primary`.
  - Assistant bubbles become `glass`.
  - The composer becomes `glass-inset rounded-full`.
  - The send button is white primary.
  - The voice recording dot becomes `bg-brand-cherry`.
- [ ] **Step 3: Pin "pending is empty"**

In `tests/design-guard.test.mjs`, add:

```js
test("every page is on the design system (PENDING is empty)", () => {
  assert.equal(PENDING.size, 0, `still pending: ${[...PENDING].join(", ")}`);
});
```

- [ ] **Step 4: Run `npm test && npx tsc --noEmit && npm run lint`. Expect all green.**
- [ ] **Step 5: Commit** `feat: chat and voice colors on the design system` (with the trailer).

---

### Task 8: Verify, push, PR

- [ ] **Step 1:** Run `npm run build` (Node 24). Expect success.
- [ ] **Step 2:** Run the dev server on 3200. Take one viewport screenshot (1440×900) each of `/login`, `/design` and `/browse` signed out. Read each and check:
  - Text is readable.
  - The pill is on top.
  - The glow intensity is right for the route.
  - Nothing is white-on-white.
- [ ] **Step 3:** Ask the user to sign in on http://localhost:3200 and click through Events, an event with matches, Inbox, Profile, Agents and New event.
- [ ] **Step 4:** Push, then open the PR against `abidanalyze/design-system-foundations`. Title: "Design system: top bar and every page (PR 2 of 4)". Body: what changed, the stacked-PR note ("retarget to main after #14 merges"), the checks, and the screenshots list.
