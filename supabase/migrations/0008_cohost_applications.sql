-- A company can apply to co-host an event someone else posted.
-- The host approves or rejects that application with the same decide_invite
-- path used when a company accepts a host invite.
-- Event rows stay owner-only. posted_events returns the public fields only.

do $$
declare
  r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'invites'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.invites drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.invites
  add constraint invites_status_check
  check (status in ('pending', 'accepted', 'declined', 'approved', 'rejected', 'applied'));

alter table public.invites
  add column if not exists requested_by text not null default 'host'
  check (requested_by in ('host', 'partner'));

create or replace function public.decide_invite(p_invite_id uuid, p_approve boolean)
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
     and status in ('accepted', 'applied')
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

drop function public.my_invites();

create function public.my_invites()
returns table (
  id uuid,
  status text,
  note text,
  created_at timestamptz,
  requested_by text,
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
         invites.requested_by,
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

create function public.posted_events()
returns table (
  id uuid,
  title text,
  topic text,
  format text,
  city text,
  timezone text,
  date_start timestamptz,
  date_end timestamptz,
  dates_flexible boolean,
  guest_count integer,
  host_name text,
  application_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select events.id,
         events.title,
         events.topic,
         events.format,
         events.city,
         events.timezone,
         events.date_start,
         events.date_end,
         events.dates_flexible,
         events.guest_count,
         host.name,
         invites.status
    from public.events
    left join public.profiles host on host.user_id = events.owner_id
    left join public.profiles mine on mine.user_id = (select auth.uid())
    left join public.invites
      on invites.event_id = events.id
     and invites.profile_id = mine.id
   where events.owner_id is distinct from (select auth.uid())
     and events.date_end > now()
   order by events.date_start;
$$;

create function public.apply_to_event(p_event_id uuid, p_note text default null)
returns public.invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_invite public.invites;
begin
  if v_uid is null then
    raise exception 'Sign in to continue.';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Note must be 500 characters or fewer.';
  end if;

  select id into v_profile_id
    from public.profiles
   where user_id = v_uid;

  if v_profile_id is null then
    raise exception 'Save your company profile before applying.';
  end if;

  if not exists (
    select 1 from public.events
     where id = p_event_id
       and owner_id is distinct from v_uid
       and date_end > now()
  ) then
    raise exception 'Event not found.';
  end if;

  if exists (
    select 1 from public.invites
     where event_id = p_event_id
       and profile_id = v_profile_id
  ) then
    raise exception 'You already have a request for this event.';
  end if;

  insert into public.invites (event_id, profile_id, status, note, requested_by)
  values (p_event_id, v_profile_id, 'applied', v_note, 'partner')
  returning * into v_invite;

  return v_invite;
end;
$$;

revoke all on function public.my_invites() from public, anon;
revoke all on function public.posted_events() from public, anon;
revoke all on function public.apply_to_event(uuid, text) from public, anon;
revoke all on function public.decide_invite(uuid, boolean) from public, anon;

grant execute on function public.my_invites() to authenticated;
grant execute on function public.posted_events() to authenticated;
grant execute on function public.apply_to_event(uuid, text) to authenticated;
grant execute on function public.decide_invite(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
