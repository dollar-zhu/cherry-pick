-- Events created from a confirmed chat intent (SUP-8).
-- Columns mirror src/lib/intent.ts. SUP-5 owns the full schema; fold this
-- table into it rather than redefining it.

create table public.events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- tool call that produced the intent; makes Confirm idempotent per user
  source_tool_call_id text not null check (char_length(source_tool_call_id) between 1 and 200),
  title text not null check (char_length(title) between 3 and 120),
  topic text not null check (char_length(topic) between 2 and 200),
  goal text not null check (char_length(goal) between 2 and 500),
  format text not null check (char_length(format) between 2 and 80),
  city text not null check (char_length(city) between 2 and 120),
  date_start timestamptz not null,
  date_end timestamptz not null,
  guest_count integer not null check (guest_count between 1 and 10000),
  budget_cap_cents bigint not null check (budget_cap_cents between 0 and 10000000000),
  sales_boundary text not null check (char_length(sales_boundary) between 2 and 500),
  partner_criteria text not null check (char_length(partner_criteria) between 2 and 1000),
  created_at timestamptz not null default now(),
  constraint events_dates_ordered check (date_end >= date_start),
  constraint events_owner_source_tool_call_key unique (owner_id, source_tool_call_id)
);

-- owner_id lookups (RLS, "my events") are served by the unique index above.

alter table public.events enable row level security;

create policy events_select_own on public.events
  for select to authenticated
  using ((select auth.uid()) = owner_id);

create policy events_insert_own on public.events
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);

revoke all on public.events from anon;
grant select, insert on public.events to authenticated;
