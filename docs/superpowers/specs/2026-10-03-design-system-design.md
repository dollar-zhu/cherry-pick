# Cherry Pick design system: design spec

Date: 2026-10-03
Status: approved in brainstorming, waiting on PR #8 before implementation

## Goal

Every screen in Cherry Pick uses one dark "gradient glass" look, built from shared design tokens and components, so new pages (Inbox, voice chat, MCP) match without extra design work.

## Constraints

- Build on the shadcn kit from PR #8 (`codex/auth-flow`): `base-nova` style, Base UI primitives, lucide icons, `cn` helper. Start only after PR #8 merges to `main`.
- Dark theme only. Desktop only. No light mode, no phone layouts.
- Keep shadcn components updatable: restyle through CSS variables and small `cva` edits, do not rewrite them.
- Follow `AGENTS.md`: read `node_modules/next/dist/docs/` before using a Next.js API (fonts, `icon.png`, layouts).

## Brand

- **Logo.** Supplied artwork, used as is: a flat cherry pair plus a lowercase "cherrypick" wordmark. Sources are in `docs/superpowers/specs/assets/`:
  - `logo-lockup-white.png`: all white. Use it on every dark surface (top bar at 22px height, hero, app).
  - `logo-lockup-color.png`: red cherries, black wordmark. Use it only on white (emails, invites, decks). Never on the dark UI.
  - The red cherry alone is the mark: favicon and app icon (`src/app/icon.png`), 16–64px.
  - `Logo variant="full" | "mark"` renders these. Ready-to-use trimmed files: `brand-lockup-white.png` and `brand-lockup-color.png` (1200×271), `brand-mark.png` (512×512, the red cherry alone). Swap in SVGs if a vector source turns up.
  - The earlier glossy 3D app icon is retired.
- **Font.** Geist Sans (already loaded in `layout.tsx`). Remove the `font-family: Arial` override in `globals.css`.
- **Voice avatar.** A gradient orb (`Orb` component).

## Tokens (`src/app/globals.css`)

`<html>` always has class `dark`. Values replace the neutral kit values.

| Token | Value | Use |
|---|---|---|
| `--background` | `#070505` | page |
| `--foreground` | `#F5F2F0` | text |
| `--card` / `--card-foreground` | `rgb(255 255 255 / 3.5%)` / foreground | glass panels |
| `--popover` | `rgb(24 16 16 / 85%)` | menus, dialogs |
| `--primary` / `--primary-foreground` | `#FFFFFF` / `#1A0505` | white primary button |
| `--secondary`, `--muted`, `--accent` | `rgb(255 255 255 / 6%)` | ghost, hover |
| `--muted-foreground` | `rgb(255 255 255 / 55%)` | secondary text (about 6:1 contrast) |
| `--border` / `--input` | `rgb(255 255 255 / 10%)` / `12%` | glass edge |
| `--ring` | `rgb(255 106 26 / 60%)` | focus ring |
| `--destructive` | `#FF4D4D` | errors, delete |
| `--success` (new) | `#34D399` | success alerts |
| `--warning` (new) | `#FBBF24` | warning alerts |
| `--brand-cherry` (new) | `#E1122B` | glow, orb, gradient |
| `--brand-orange` (new) | `#FF6A1A` | glow, orb, gradient |
| `--brand-amber` (new) | `#FFC08A` | glow core |
| `--brand-gradient` (new) | `linear-gradient(135deg, var(--brand-orange), var(--brand-cherry))` | decoration only: orb, highlights, accents. No text on it (white on `#FF6A1A` is 2.9:1) |
| `--brand-gradient-text` (new) | `linear-gradient(135deg, #D9361A, #B80A1D)` | brand button, user chat bubble: anything with white text on it (at least 4.5:1) |
| `--radius` | `0.875rem` (14px) | panels; inputs use 10px; buttons, chips, top bar are pills |

### Color roles

- **White** = everyday primary action (Save, Continue).
- **Cherry gradient** = AI and brand actions only (Find co-hosts, voice, Publish, user chat bubble). Keep it rare so it stays special.
- **Red** = errors and destructive actions only.
- **Green** = success.

### Glass utilities (Tailwind v4 `@utility`)

| Utility | Recipe | Use |
|---|---|---|
| `glass` | fill `rgb(255 255 255 / 3.5%)`, `backdrop-filter: blur(24px) saturate(140%)`, 1px border `rgb(255 255 255 / 10%)`, `inset 0 1px 0 rgb(255 255 255 / 8%)`, `0 10px 30px rgb(0 0 0 / 25%)` | panels, cards, top bar |
| `glass-inset` | fill `rgb(10 6 6 / 35%)`, same blur and border | inputs, chat composer |
| `glass-raised` | fill `var(--popover)`, same blur and border, stronger shadow | dropdowns, dialogs, toasts |

### Glow

`Glow` is one fixed layer behind the page, pure CSS, no animation. It is black at the top, with one smooth cherry-to-orange glow rising from the bottom edge and a warm white core at bottom center. No separate columns or bands.

- `intensity="app"`: 27.5% opacity (signed-in pages). Its hottest color is `--brand-orange`, with no warm-white core, so muted text over the glow stays at least 4.5:1.
- `intensity="hero"`: 50% (login, onboarding, unsubscribe, empty states). It keeps the warm-white core. Hero content sits in the top 65% of the screen, and no text goes directly on glass over the bottom core.
- Only one glow layer per page. Keep stacked `backdrop-filter` layers to 2 or fewer for GPU cost.

### Type scale

| Name | Size / weight |
|---|---|
| Display | 32px / 600, tracking -0.03em |
| H1 | 24px / 600 |
| H2 | 18px / 600 |
| Body | 14px / 400 |
| Small | 12px / 400 |

Numbers in tables use `tabular-nums`. Spacing uses the Tailwind default scale.

## Components

### shadcn (`src/components/ui/`), added only when a page needs them

| Component | Change |
|---|---|
| `button` | `rounded-full`. Variants: `default` white, `brand` (new) gradient + glow, `outline` and `ghost` glass, `destructive`, `link` |
| `input`, `textarea` | `glass-inset`, 10px radius |
| `card` | `glass` |
| `alert` | add `success`, `warning` variants |
| `badge`, `table`, `checkbox` | tokens only |
| `dialog`, `dropdown-menu`, `tooltip` | `glass-raised` |
| `avatar`, `skeleton`, `sonner` | tokens only |

### Brand (`src/components/brand/`)

| Component | API | Notes |
|---|---|---|
| `Logo` | `variant: "mark" \| "full"`, `size` | flat SVG |
| `Glow` | `intensity: "app" \| "hero"` | fixed, `aria-hidden` |
| `Orb` | `size`, `state: "idle" \| "listening" \| "thinking" \| "speaking"` | CSS-only animation; respects `prefers-reduced-motion`; the voice feature only sets `state` |
| `TopNav` | `items: { href, label, icon }[]` | floating glass pill: logo, items, `+ New event` (brand button), avatar menu with sign-out |
| `AppShell` | `children` | `Glow app` + `TopNav` + content, max width 1200px |
| `HeroShell` | `children` | `Glow hero` + centered content |
| `PageHeader` | `title`, `description`, `actions` | |
| `EmptyState` | `title`, `description`, `action` | |

### Chat (`src/components/assistant/`)

- User bubble: `--brand-gradient`, white text. Assistant bubble: `glass`.
- Composer: `glass-inset` pill with an `Orb`-style mic button.
- `IntentCard`: `glass` card, brand button for the main action.

## Invite email

The outreach invite becomes an HTML email in the same visual language. Today outreach sends plain text only (`src/lib/outreach/send.ts`). The plain-text body and the unsubscribe header stay as the fallback.

Layout, top to bottom (based on the supplied invite reference, recolored):

1. **Co-brand bar.** `HOST × PARTNER` in bold white text. Text, not logos, because `profiles` has no logo column. A logo column is a separate, optional change.
2. **Key art banner.** A raised glass card: frosted panel (white 20% → 3% sheen), bright 22% white edge with a top highlight, deep drop shadow and an orange halo, floating over a cherry/orange glow. Event title in heavy white uppercase, date and city in spaced mono caps. A glossy 3D orb breaks out past the top-right corner. Email can't render glass, so the banner is **one PNG per event**, rendered on the server with `next/og` `ImageResponse` (glass faked with layered gradients and shadows), with the title, date and city in its `alt` text.
3. **Meta line.** Day, date, time, area.
4. **Headline.** White, one accent word in solid `#FF6A1A` (email can't do gradient text).
5. **Pitch.** One sentence.
6. **Labeled blocks.** "Your part" and "What's in it for you", labels in orange mono caps `#FF8A3D`.
7. **CTA.** White pill button, `#1A0505` text: "Count us in ↗". Below it, a "Not this time" text link.
8. **Footer.** Cherry glow rising from the bottom (hosted image), "Sent with [white logo] for HOST · Unsubscribe".

Email rules:

- 600px single column, table layout, inline styles.
- Solid hex colors only. No `rgba`, no CSS variables, no `backdrop-filter`.
- The banner is a per-event PNG from `next/og`. The footer glow is a static PNG in `public/email/`. Both have a solid `bgcolor` fallback (`#2A0A0C` banner, `#070505` footer).
- Font stack: `Geist, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`.
- `<meta name="color-scheme" content="dark">` and `supported-color-schemes`, so clients don't invert it.
- All copy is filled in from the event and both companies' profiles. No copy is hard-coded.
- Test in Gmail (web and iOS), Outlook (web and desktop) and Apple Mail before shipping.

## App layout and page moves

| Route | Shell |
|---|---|
| `(app)/` Events home | `AppShell` |
| `(app)/events/new` | `AppShell` |
| `(app)/events/[id]` | `AppShell` |
| `(app)/profile` (menu label "Company", URL unchanged) | `AppShell` |
| `/login`, `/onboarding`, `/unsubscribe` | `HeroShell` |

Menu: Events, Inbox, Company, Credits, plus `+ New event` and the avatar. The Inbox and Credits items are added in the PR that builds each page, so the menu never links to a page that doesn't exist.

## Guardrails

- New test `tests/design-tokens.test.mjs`: fails if files in `src/app` or `src/components` (except `src/components/ui` and `src/components/brand`) contain raw palette classes (`zinc-`, `neutral-`, `gray-`, `red-`, and so on) or hex colors.
- Dev-only `/design` page renders every token, glass level, button variant, component and the `Orb` states. It is the living reference.
- Add a short "UI rules" section to `AGENTS.md`: use tokens and components, no raw colors, white = primary, gradient = AI/brand only.

## Delivery

Blocked on PR #8 merging. Then branch `design-system` from `main`.

1. **PR 1, Foundations.** Tokens, glass utilities, font fix, favicon, brand components, button/alert variants, `/design` page, guard test, AGENTS.md rules.
2. **PR 2, App layout and pages.** `AppShell`, `HeroShell`, `TopNav`; migrate every page listed above.
3. **PR 3, Chat and Orb.** Restyle thread, composer and intent card. Coordinate with the voice/MCP teammate first.
4. **PR 4, Invite email.** HTML template plus plain-text fallback in the outreach sender, hosted images, client tests. Coordinate with the outreach owner (SUP-20).

Tell the PR #8 author (Aditya), the SUP-10 Inbox author, and the voice/MCP teammate before PR 2 and PR 3.

## Testing

- `npm run build`, `npm run lint`, `npm test` (includes the guard test).
- Playwright screenshot of each page and of `/design`, attached to each PR.
- Contrast check: body text and `--muted-foreground` on `--background` and on `glass` over the hero glow are at least 4.5:1.

## Out of scope

Light mode, phone layouts, marketing site, building the Inbox and Credits pages, logo redesign.
