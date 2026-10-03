-- Prefiltered and model-ranked co-host candidates for an event (SUP-9).
-- References public.profiles (the partner directory) and public.events (SUP-8).

create table public.event_candidates (
  id          uuid           primary key default gen_random_uuid(),
  event_id    uuid           not null references public.events(id)    on delete cascade,
  profile_id  uuid           not null references public.profiles(id)  on delete cascade,
  score       numeric(4, 1)  not null check (score between 0 and 10),
  reasons     text[]         not null default '{}',
  ranked_at   timestamptz    not null default now(),
  constraint event_candidates_event_profile_key unique (event_id, profile_id)
);

alter table public.event_candidates enable row level security;

-- Only the event owner may read or write their candidates.
create policy event_candidates_select_own on public.event_candidates
  for select to authenticated
  using (
    exists (
      select 1 from public.events
       where events.id       = event_candidates.event_id
         and events.owner_id = (select auth.uid())
    )
  );

create policy event_candidates_insert_own on public.event_candidates
  for insert to authenticated
  with check (
    exists (
      select 1 from public.events
       where events.id       = event_candidates.event_id
         and events.owner_id = (select auth.uid())
    )
  );

create policy event_candidates_update_own on public.event_candidates
  for update to authenticated
  using (
    exists (
      select 1 from public.events
       where events.id       = event_candidates.event_id
         and events.owner_id = (select auth.uid())
    )
  );

revoke all on public.event_candidates from anon;
grant select, insert, update on public.event_candidates to authenticated;
