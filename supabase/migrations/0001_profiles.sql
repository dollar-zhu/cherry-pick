-- Cherry Pick, layer 1: company profiles.
-- Run in the Supabase SQL editor. Already applied to the shared database: do not edit.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  -- null for seeded demo organizations, which have no auth user
  user_id uuid unique references auth.users (id) on delete cascade,
  is_demo boolean not null default false,

  name text not null,
  description text not null,
  city text not null,
  audience text not null,
  topics text[] not null default '{}',
  brings text[] not null default '{}'
    check (brings <@ array['venue', 'speakers', 'audience', 'budget', 'equipment']),
  needs text[] not null default '{}'
    check (needs <@ array['venue', 'speakers', 'audience', 'budget', 'equipment']),
  budget_usd integer check (budget_usd >= 0),
  is_seeking_partners boolean not null default true,

  -- Venue fields. null = unknown; amenities '{}' = known to have none.
  -- ponytail: one nullable array for all amenities; per-amenity yes/no/unknown if matching needs it.
  venue_capacity integer check (venue_capacity > 0),
  amenities text[]
    check (amenities <@ array['projector', 'wifi', 'av_system', 'catering', 'kitchen',
                              'step_free_access', 'accessible_restroom', 'parking']),
  available_weekdays smallint[] check (available_weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  available_from date,
  available_to date,
  check (available_from is null or available_to is null or available_from <= available_to),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_city_idx on public.profiles (lower(city));

alter table public.profiles enable row level security;

-- Every signed-in user can read all profiles (matching needs candidates).
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);

drop policy if exists "users insert own profile" on public.profiles;
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (user_id = auth.uid() and not is_demo);

drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and not is_demo);
