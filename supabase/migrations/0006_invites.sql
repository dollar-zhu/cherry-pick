-- Invites from an event host to a matched company (SUP-10). Needs 0005 (events.timezone).
-- Writes go through send_invites, respond_to_invite, and decide_invite.
-- Authenticated users can only select. Inbox event fields come from my_invites.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'approved', 'rejected')),
  note text check (note is null or char_length(note) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invites_event_profile_key unique (event_id, profile_id)
);

create index invites_profile_id_idx on public.invites (profile_id);
create index invites_event_status_idx on public.invites (event_id, status);

alter table public.invites enable row level security;

create policy invites_select_participant on public.invites
  for select to authenticated
  using (
    exists (
      select 1 from public.events
       where events.id = invites.event_id
         and events.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.profiles
       where profiles.id = invites.profile_id
         and profiles.user_id = (select auth.uid())
    )
  );

revoke all on public.invites from anon, authenticated, public;
grant select on public.invites to authenticated;

create function public.send_invites(p_event_id uuid, p_profile_ids uuid[])
returns setof public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[];
begin
  if v_uid is null then
    raise exception 'Sign in to continue.';
  end if;

  select coalesce(array_agg(distinct pid), '{}')
    into v_ids
    from unnest(coalesce(p_profile_ids, '{}')) as pid
   where pid is not null;

  if cardinality(v_ids) = 0 then
    raise exception 'Select at least one company.';
  end if;

  if cardinality(v_ids) > 25 then
    raise exception 'You can send at most 25 invites at a time.';
  end if;

  if not exists (
    select 1 from public.events
     where id = p_event_id
       and owner_id = v_uid
  ) then
    raise exception 'Event not found.';
  end if;

  if exists (
    select 1
      from unnest(v_ids) as pid
     where not exists (
       select 1 from public.event_candidates
        where event_id = p_event_id
          and profile_id = pid
     )
  ) then
    raise exception 'You can only invite matched companies.';
  end if;

  if exists (
    select 1
      from unnest(v_ids) as pid
      join public.profiles on profiles.id = pid
     where profiles.user_id = v_uid
  ) then
    raise exception 'You cannot invite your own company.';
  end if;

  return query
  insert into public.invites (event_id, profile_id, status)
  select p_event_id, pid, 'pending'
    from unnest(v_ids) as pid
  on conflict (event_id, profile_id) do nothing
  returning *;
end;
$$;

create function public.respond_to_invite(
  p_invite_id uuid,
  p_accept boolean,
  p_note text default null
)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_uid is null then
    raise exception 'Sign in to continue.';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note must be 500 characters or fewer.';
  end if;

  update public.invites
     set status = case when p_accept then 'accepted' else 'declined' end,
         note = case when p_accept then v_note else null end,
         updated_at = now()
   where id = p_invite_id
     and status = 'pending'
     and profile_id in (
       select id from public.profiles where user_id = v_uid
     )
  returning * into v_invite;

  if not found then
    raise exception 'This invite is no longer waiting for a response.';
  end if;

  return v_invite;
end;
$$;

create function public.decide_invite(p_invite_id uuid, p_approve boolean)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_invite public.invites;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.';
  end if;

  update public.invites
     set status = case when p_approve then 'approved' else 'rejected' end,
         updated_at = now()
   where id = p_invite_id
     and status = 'accepted'
     and event_id in (
       select id from public.events where owner_id = v_uid
     )
  returning * into v_invite;

  if not found then
    raise exception 'This invite is not waiting for your decision.';
  end if;

  return v_invite;
end;
$$;

-- Event rows stay owner-only. This returns the caller's invites with the
-- event fields the inbox needs, without opening the host's event page.
create function public.my_invites()
returns table (
  id uuid,
  status text,
  note text,
  created_at timestamptz,
  event_title text,
  event_city text,
  event_topic text,
  event_date_start timestamptz,
  event_date_end timestamptz,
  event_timezone text,
  event_dates_flexible boolean,
  host_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select invites.id,
         invites.status,
         invites.note,
         invites.created_at,
         events.title,
         events.city,
         events.topic,
         events.date_start,
         events.date_end,
         events.timezone,
         events.dates_flexible,
         host.name
    from public.invites
    join public.events on events.id = invites.event_id
    join public.profiles on profiles.id = invites.profile_id
    left join public.profiles host on host.user_id = events.owner_id
   where profiles.user_id = (select auth.uid());
$$;

revoke all on function public.my_invites() from public, anon;
revoke all on function public.send_invites(uuid, uuid[]) from public, anon;
revoke all on function public.respond_to_invite(uuid, boolean, text) from public, anon;
revoke all on function public.decide_invite(uuid, boolean) from public, anon;

grant execute on function public.my_invites() to authenticated;
grant execute on function public.send_invites(uuid, uuid[]) to authenticated;
grant execute on function public.respond_to_invite(uuid, boolean, text) to authenticated;
grant execute on function public.decide_invite(uuid, boolean) to authenticated;

-- Local Supabase no longer grants Data API access on new tables. The shared
-- database already had these privileges from older defaults. Profiles needs
-- them for the signed-in profile form and the company directory.

grant select, insert, update on public.profiles to authenticated;
