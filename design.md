# Design — Cherry Pick

The locked design system for the app. Read this file before you change any page. Extend it here when the system needs to grow.

## Genre
modern-minimal, with a warm serif for titles.

## Pages
- Home (`/`): company name as the page title, then "Your events" and "Inbox" as card grids.
- List pages (inbox): page title, one line of help text, card grid.
- Form pages (profile, plan an event): one narrow column (`max-w-3xl`), sections in rounded cards.

## Tokens
All tokens live in `src/app/globals.css` (`:root` and the dark block), and Tailwind exposes them through `@theme inline`.
Use the utilities `bg-paper`, `bg-paper-2`, `bg-card`, `text-ink`, `text-ink-2`, `border-rule`, `bg-accent`, `text-accent-ink`. Do not use `zinc-*`, raw hex, or raw OKLCH in components.

- paper `oklch(98.6% 0.004 80)`, ink `oklch(21% 0.012 40)`, accent (cherry) `oklch(53% 0.2 22)`.
- The accent is for the main action, waiting counts, and errors only.
- Event covers use `--cover-0` to `--cover-5`. The title picks one.

## Typography
- Body and UI: Schibsted Grotesk (`font-sans`).
- Page titles, section titles, and card dates: Newsreader (`font-display`), upright only.
- Code and scores: the system mono (`font-mono`).
- Do not use Geist, Inter, or system fonts.

## Components
- Shared class strings: `src/components/ui.ts` (`buttonPrimary`, `buttonDark`, `buttonQuiet`, `input`, `pageTitle`).
- Cards: `src/components/event-card.tsx` (`EventCard`, `EventCover`, `CoverPill`, `cardGrid`).
- Company mark: `src/components/monogram.tsx`.

## Motion
- Easings `--ease-out`, `--ease-in`. Durations `--dur-micro` 120 ms, `--dur-short` 220 ms, `--dur-long` 420 ms.
- One entrance per page: the `.reveal` class, staggered with the `--i` custom property.
- Animate `transform` and `opacity` only. Reduced motion collapses to a 150 ms fade.
