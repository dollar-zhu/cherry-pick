-- Event fliers (SUP-23). Needs 0003 (events) and 0006 (invites).
-- 0007 is taken by the MCP approvals migration (SUP-17).
--
-- A flier is an abstract background from Nano Banana with the event text set on
-- top by the server. Each generate or refine adds a version; nothing is edited in
-- place. Both files live in the private "fliers" bucket under "<event_id>/".
--
-- Who can do what:
--   host (events.owner_id)            insert rows and files, read them
--   approved co-host (invites.status) read them
-- The co-host side of approval and sending is SUP-24/SUP-25.

create table public.fliers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  version integer not null check (version >= 1),
  -- PNG with the text, and the background it was built from (reused by "new fonts").
  storage_path text not null,
  background_path text,
  -- 'gemini' = Nano Banana image; 'fallback' = the vibe's CSS gradient after a failure,
  -- which has no background file.
  background_source text not null check (background_source in ('gemini', 'fallback')),
  model text,
  vibe text not null check (char_length(vibe) between 1 and 40),
  font_set text not null check (char_length(font_set) between 1 and 40),
  layout text not null check (layout in ('bottom', 'center', 'split')),
  -- refine instruction for this version, e.g. 'darker, add a skyline'; null for a fresh one
  instruction text check (instruction is null or char_length(instruction) between 1 and 300),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint fliers_event_version_key unique (event_id, version),
  constraint fliers_background_matches_source check (
    (background_source = 'gemini') = (background_path is not null)
  ),
  constraint fliers_paths_in_event_folder check (
    storage_path like event_id::text || '/%'
    and (background_path is null or background_path like event_id::text || '/%')
  )
);

alter table public.fliers enable row level security;

-- True if the signed-in user hosts the event or is an approved co-host of it.
-- security definer: co-hosts cannot select the host's events row.
create function public.can_view_event_fliers(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
     where e.id = p_event_id and e.owner_id = (select auth.uid())
  ) or exists (
    select 1
      from public.invites i
      join public.profiles p on p.id = i.profile_id
     where i.event_id = p_event_id
       and i.status = 'approved'
       and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.can_view_event_fliers(uuid) from public, anon;
grant execute on function public.can_view_event_fliers(uuid) to authenticated;

create policy fliers_select_participant on public.fliers
  for select to authenticated
  using (public.can_view_event_fliers(event_id));

create policy fliers_insert_host on public.fliers
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1 from public.events e
       where e.id = fliers.event_id and e.owner_id = (select auth.uid())
    )
  );

revoke all on public.fliers from anon, authenticated, public;
grant select, insert on public.fliers to authenticated;

-- Private bucket; the app reads files through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fliers', 'fliers', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Object names are '<event_id>/<file>'. CASE checks the folder is a uuid before the
-- cast, so a malformed name is denied instead of raising an error.
create policy fliers_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fliers'
    and case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then public.can_view_event_fliers(((storage.foldername(name))[1])::uuid)
      else false
    end
  );

create policy fliers_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fliers'
    and exists (
      select 1 from public.events e
       where e.id::text = (storage.foldername(name))[1]
         and e.owner_id = (select auth.uid())
    )
  );

notify pgrst, 'reload schema';
