<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Cherry Pick database rules

The matching layer (event chat → search) depends on the profile data. Follow these rules when you change the database or the profile form.

## Migrations

- Put each schema change in a new file in `supabase/migrations/`. Use the next number: `0002_add_logo_url.sql`, `0003_...`.
- Do not edit a migration after it has run on the shared database. Write a new migration that changes it.
- Run new migrations in the Supabase SQL editor, in number order.

## Columns that matching depends on

Do not rename these columns of `profiles` or change what they mean: `city`, `venue_capacity`, `amenities`, `available_weekdays`, `available_from`, `available_to`, `is_seeking_partners`, `has_venue`.

- `amenities` null means "unknown". An empty list (`'{}'`) means "known to have none". Keep this difference.
- `available_weekdays` uses Postgres day numbers: 0 = Sunday, 4 = Thursday, 6 = Saturday.
- If one of these columns must change, tell the person who works on matching first.

## Keep the lists in sync

- `src/lib/contracts.ts` (zod) and the SQL check constraint must contain the same values for `amenities`.
- The profile holds general company facts only. What a company brings or needs for an event, and its budget, belong in the event brief, not in `profiles`.
- If you add or remove a value, change both in the same PR: the zod list, and the check constraint in a new migration.

## Seed data

- `supabase/seed.sql` holds the fictional demo companies (`is_demo = true`). The demo story depends on which rows each constraint removes. Read the comments in the file before you change rows.
- If you add a `not null` column without a default, update `supabase/seed.sql` in the same PR, or the seed fails.

## Safe to change

- The auth flow: sign-up, password reset, OAuth, the confirm-email setting.
- The look and the steps of the profile form.
- New optional (nullable) profile columns.

# Cherry Pick UI rules

The design system lives in `src/app/globals.css` (tokens), `src/components/ui/` (shadcn kit) and `src/components/brand/` (Logo, Glow, Orb, PageHeader, EmptyState). Run `npm run dev` and open `/design` to see every piece. Spec: `docs/superpowers/specs/2026-10-03-design-system-design.md`.

- Use tokens only: `bg-primary`, `text-muted-foreground`, `border-border`, `bg-success`, and so on. No `zinc-*`, `red-*` or hex colors in pages. `tests/design-guard.test.mjs` fails on them.
- White (`<Button>`) is the everyday primary action. `<Button variant="brand">` is only for AI and brand actions (find co-hosts, voice, publish). Red (`variant="destructive"`) only for actions that lose something.
- Panels and cards use `glass`, inputs use `glass-inset`, menus and dialogs use `glass-raised`.
- Never put text on `bg-brand-gradient`. Use `bg-brand-gradient-text` for anything with white text.
- One `<Glow>` per page, behind an `above-glow` content wrapper (z 1, so the sticky top bar at z-10 stays on top). `intensity="app"` for signed-in pages, `"hero"` for login, onboarding and empty states.
- The voice feature sets `<Orb state>` only. Don't restyle the orb in feature code.
- Dark only, desktop only.
