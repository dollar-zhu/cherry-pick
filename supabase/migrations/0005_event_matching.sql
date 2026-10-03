-- Matching constraints in the event brief, and open questions on candidates (SUP-9).
-- Columns mirror src/lib/intent.ts. The amenity list must stay identical to
-- AMENITIES in src/lib/contracts.ts and to the profiles.amenities check.

alter table public.events
  add column if not exists needs_venue boolean not null default false,
  -- false: date_start..date_end is the event. true: it is the window the event can move in.
  add column if not exists dates_flexible boolean not null default false,
  -- Postgres day numbers, 0 = Sunday. null = any day.
  add column if not exists allowed_weekdays smallint[]
    check (allowed_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[] and cardinality(allowed_weekdays) > 0),
  -- '{}' = no must-haves.
  add column if not exists required_amenities text[] not null default '{}'
    check (required_amenities <@ array['projector', 'wifi', 'av_system', 'catering', 'kitchen',
                                       'step_free_access', 'accessible_restroom', 'parking']);

-- null score = passed the filters but was not ranked by the model.
alter table public.event_candidates alter column score drop not null;
alter table public.event_candidates
  add column if not exists open_questions text[] not null default '{}';

notify pgrst, 'reload schema';
