-- Profiles hold general company facts only. What a company brings or needs, and its budget,
-- change with each event, so they move to the event brief (layer 2).

alter table public.profiles add column if not exists website_url text;
alter table public.profiles add column if not exists has_venue boolean not null default false;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles' and column_name = 'brings') then
    update public.profiles set has_venue = 'venue' = any (brings);
  end if;
end $$;

alter table public.profiles drop column if exists brings;
alter table public.profiles drop column if exists needs;
alter table public.profiles drop column if exists budget_usd;

notify pgrst, 'reload schema';
