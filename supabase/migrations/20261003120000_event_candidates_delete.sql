-- Replacing a match set deletes rows that are no longer candidates.
-- The create migration only granted select, insert, and update.

create policy event_candidates_delete_own on public.event_candidates
  for delete to authenticated
  using (
    exists (
      select 1 from public.events
       where events.id       = event_candidates.event_id
         and events.owner_id = (select auth.uid())
    )
  );

grant delete on public.event_candidates to authenticated;
