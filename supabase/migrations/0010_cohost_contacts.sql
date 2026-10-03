-- Handoff after approval: the host and an approved co-host can see each other's
-- sign-in email. Needs 0008 (my_invites with requested_by).
-- Emails live in auth.users, so both functions are security definer and return an
-- email only when the invite status is 'approved'. Demo companies have no user, so
-- their email is null.

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
  host_name text,
  host_email text
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
         host.name,
         case when invites.status = 'approved' then host_user.email::text end
    from public.invites
    join public.events on events.id = invites.event_id
    join public.profiles on profiles.id = invites.profile_id
    left join public.profiles host on host.user_id = events.owner_id
    left join auth.users host_user on host_user.id = events.owner_id
   where profiles.user_id = (select auth.uid());
$$;

-- For the host's event page: the email of each approved co-host.
create function public.event_cohost_contacts(p_event_id uuid)
returns table (invite_id uuid, email text)
language sql
stable
security definer
set search_path = public
as $$
  select invites.id, partner_user.email::text
    from public.invites
    join public.events on events.id = invites.event_id
    join public.profiles on profiles.id = invites.profile_id
    left join auth.users partner_user on partner_user.id = profiles.user_id
   where invites.event_id = p_event_id
     and invites.status = 'approved'
     and events.owner_id = (select auth.uid());
$$;

revoke all on function public.my_invites() from public, anon;
revoke all on function public.event_cohost_contacts(uuid) from public, anon;

grant execute on function public.my_invites() to authenticated;
grant execute on function public.event_cohost_contacts(uuid) to authenticated;

notify pgrst, 'reload schema';
