-- Local Supabase no longer grants Data API access on new tables. The shared
-- database already had these privileges from older defaults. Profiles needs
-- them for the signed-in profile form and the company directory.

grant select, insert, update on public.profiles to authenticated;
