-- Cherry Pick demo data: 18 fictional organizations (is_demo = true).
-- Run after all files in supabase/migrations/. Safe to run again: it replaces only demo rows.
-- Demo story: an AI company (speakers + $500, set in its event brief) needs an SF venue for a 50-person workshop,
-- then adds "Thursdays only". Comments mark which rows each constraint removes.
-- Weekdays: 0 = Sun ... 4 = Thu ... 6 = Sat.
-- The end of this file adds demo events that every company sees on /browse.

delete from public.profiles where is_demo;

insert into public.profiles
  (is_demo, name, description, city, audience, topics, website_url, has_venue, is_seeking_partners,
   venue_capacity, amenities, available_weekdays, available_from, available_to)
values
  -- Strong matches (SF, capacity >= 50, Thursdays)
  (true, 'Mission Loft Collective', 'Fictional demo org. Coworking loft that hosts evening tech talks for its members.',
   'San Francisco', 'Startup founders and early-stage engineers', '{AI,startups,developer tools}',
   null, true, true,
   80, '{projector,wifi,av_system,step_free_access,accessible_restroom}', '{2,4}', '2026-10-01', '2026-12-31'),
  (true, 'SoMa Founders Hub', 'Fictional demo org. Accelerator space with a large event hall and an active founder community.',
   'San Francisco', 'Seed-stage founders and angel investors', '{AI,venture capital,startups}',
   null, true, true,
   120, '{projector,wifi,av_system,catering,step_free_access,accessible_restroom}', '{1,2,3,4,5}', '2026-10-01', '2027-03-31'),
  (true, 'Financial District Fintech Forum', 'Fictional demo org. Member association for fintech professionals with a downtown auditorium.',
   'San Francisco', 'Fintech product managers and engineers', '{fintech,AI,payments}',
   null, true, true,
   200, '{projector,wifi,av_system,catering,step_free_access,accessible_restroom}', '{2,4}', '2026-10-01', '2026-12-31'),
  (true, 'Presidio Learning Center', 'Fictional demo org. Nonprofit classroom space for adult education. Amenities not yet confirmed.',
   'San Francisco', 'Career changers and adult learners', '{AI,education,career development}',
   null, true, true,
   -- amenities null = unknown: shows an open question on the match card
   70, null, '{3,4}', '2026-10-01', '2026-12-31'),
  (true, 'Potrero Hardware Labs', 'Fictional demo org. Hardware prototyping lab with a demo floor. Upstairs space, no elevator.',
   'San Francisco', 'Hardware and robotics engineers', '{robotics,AI,hardware}',
   null, true, true,
   -- no step_free_access: fails an accessibility must-have
   55, '{projector,wifi,parking}', '{4}', '2026-10-01', '2026-12-31'),

  -- Removed by "Thursdays only"
  (true, 'Bayview Makerspace', 'Fictional demo org. Community makerspace with workshop benches and a projector wall.',
   'San Francisco', 'Makers, hobbyists, and students', '{AI,hardware,maker culture}',
   null, true, true,
   60, '{projector,wifi,step_free_access}', '{1,3,6}', '2026-10-01', '2026-12-31'),
  (true, 'Dogpatch Design Studio', 'Fictional demo org. Design agency that opens its studio for creative-tech events.',
   'San Francisco', 'Product designers and creative technologists', '{design,AI,UX}',
   null, true, true,
   50, '{projector,wifi,step_free_access,accessible_restroom}', '{5}', '2026-10-01', '2026-12-31'),

  -- Removed by capacity (< 50)
  (true, 'Embarcadero Data Lounge', 'Fictional demo org. Small analytics consultancy with a meeting room.',
   'San Francisco', 'Data analysts', '{data science,AI,analytics}',
   null, true, true,
   30, '{projector,wifi}', '{2,4}', '2026-10-01', '2026-12-31'),
  (true, 'Hayes Valley Book Cafe', 'Fictional demo org. Independent bookstore cafe that hosts author readings.',
   'San Francisco', 'Readers and local residents', '{books,writing,culture}',
   null, true, true,
   40, '{wifi,catering,step_free_access}', '{4,6}', '2026-10-01', '2026-12-31'),

  -- Removed by location
  (true, 'Oakland Robotics Guild', 'Fictional demo org. Robotics club with a warehouse event floor.',
   'Oakland', 'Robotics hobbyists and engineers', '{robotics,AI}',
   null, true, true,
   100, '{projector,wifi,parking,step_free_access}', '{4}', '2026-10-01', '2026-12-31'),
  (true, 'Brooklyn ML Meetup', 'Fictional demo org. Monthly machine learning meetup with a large mailing list.',
   'New York', 'ML engineers and researchers', '{AI,machine learning}',
   null, false, true,
   null, null, null, null, null),
  (true, 'Austin Cloud Collective', 'Fictional demo org. Cloud infrastructure community with an office event space.',
   'Austin', 'DevOps and platform engineers', '{cloud,AI,infrastructure}',
   null, true, true,
   90, '{projector,wifi,av_system,step_free_access}', '{4}', '2026-10-01', '2026-12-31'),
  (true, 'Berkeley Open Source Club', 'Fictional demo org. Student club that runs open-source contribution nights.',
   'Berkeley', 'University students', '{open source,AI}',
   null, false, true,
   null, null, null, null, null),

  -- Removed by "not seeking partners"
  (true, 'Tenderloin Tech Commons', 'Fictional demo org. Nonprofit digital literacy center. Fully booked this season.',
   'San Francisco', 'Local residents learning digital skills', '{digital literacy,AI,community}',
   null, true, false,
   90, '{projector,wifi,step_free_access,accessible_restroom}', '{4}', '2026-10-01', '2026-12-31'),

  -- Removed by date range (availability ended)
  (true, 'Russian Hill Rooftop', 'Fictional demo org. Rooftop event space, closed for renovation from October.',
   'San Francisco', 'Young professionals', '{networking,AI,startups}',
   null, true, true,
   75, '{wifi,catering}', '{4,5}', '2026-06-01', '2026-09-30'),

  -- Weak fit: has a venue on Thursdays, but the topic does not match
  (true, 'Marina Wellness Studio', 'Fictional demo org. Yoga and wellness studio that rents its main room for events.',
   'San Francisco', 'Health-conscious professionals', '{wellness,yoga,mindfulness}',
   null, true, true,
   60, '{wifi,step_free_access}', '{4}', '2026-10-01', '2026-12-31'),
  (true, 'Nob Hill Supper Club', 'Fictional demo org. Private dining club that co-hosts dinner events.',
   'San Francisco', 'Executives and hospitality leaders', '{food,hospitality,networking}',
   null, true, true,
   50, '{kitchen,catering,wifi}', '{4,5,6}', '2026-10-01', '2026-12-31'),

  -- No venue: cannot host the demo event
  (true, 'Sunset AI Students Association', 'Fictional demo org. University AI club with 400 members.',
   'San Francisco', 'Undergraduate and graduate AI students', '{AI,machine learning,careers}',
   null, false, true,
   null, null, null, null, null);


-- Demo events on /browse ---------------------------------------------------------------
-- Every event needs an owner in auth.users, and /browse shows the owner's company as the host.
-- So eight demo companies above get a login user. The password is empty: nobody can sign in.
-- Linking a user does not change matching, so the demo story above stays the same.
-- Nobody answers applications to these events: they stay "Waiting on the host".
-- Do not delete the demo users: that cascades to their events and to real companies' applications.

insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, recovery_token, email_change_token_new, email_change)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', email, '', now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from (values
    ('d0000000-0000-4000-8000-000000000001', 'mission-loft@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000002', 'soma-founders@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000003', 'fidi-fintech@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000004', 'nob-hill-supper@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000005', 'oakland-robotics@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000006', 'brooklyn-ml@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000007', 'austin-cloud@demo.cherrypick.invalid'),
    ('d0000000-0000-4000-8000-000000000008', 'berkeley-oss@demo.cherrypick.invalid')
  ) as hosts (id, email)
on conflict (id) do nothing;

update public.profiles
   set user_id = hosts.user_id::uuid
  from (values
    ('Mission Loft Collective',          'd0000000-0000-4000-8000-000000000001'),
    ('SoMa Founders Hub',                'd0000000-0000-4000-8000-000000000002'),
    ('Financial District Fintech Forum', 'd0000000-0000-4000-8000-000000000003'),
    ('Nob Hill Supper Club',             'd0000000-0000-4000-8000-000000000004'),
    ('Oakland Robotics Guild',           'd0000000-0000-4000-8000-000000000005'),
    ('Brooklyn ML Meetup',               'd0000000-0000-4000-8000-000000000006'),
    ('Austin Cloud Collective',          'd0000000-0000-4000-8000-000000000007'),
    ('Berkeley Open Source Club',        'd0000000-0000-4000-8000-000000000008')
  ) as hosts (name, user_id)
 where profiles.is_demo and profiles.name = hosts.name;

-- Dates are relative to the day the seed runs, so the events stay upcoming.
-- Running the seed again moves only the dates. Event ids and applications stay.
-- in_days and start time are in the event's own time zone.
insert into public.events
  (owner_id, source_tool_call_id, title, topic, goal, format, city, timezone,
   date_start, date_end, guest_count, budget_cap_cents, currency, sales_boundary, partner_criteria,
   needs_venue, dates_flexible, allowed_weekdays, required_amenities)
select owner::uuid, 'demo-seed-' || n, title, topic, goal, format, city, tz,
       ((now() at time zone tz)::date + in_days + start_at) at time zone tz,
       ((now() at time zone tz)::date + in_days + start_at + hours * interval '1 hour') at time zone tz,
       guests, budget_cents, 'USD',
       'No product pitches from partners on stage.',
       partner_criteria,
       false, false, null, '{}'
  from (values
    (1, 'd0000000-0000-4000-8000-000000000001', 'Agents in Production: Demo Night',
        'AI agents', 'Show real agent deployments and meet teams that ship them.', 'demo night',
        'San Francisco', 'America/Los_Angeles', 9, time '18:00', 3, 80, 150000,
        'A developer tools or AI infra company that can bring two speakers.'),
    (2, 'd0000000-0000-4000-8000-000000000002', 'Seed Founders Breakfast',
        'Fundraising', 'Connect seed-stage founders with angels in a small room.', 'breakfast',
        'San Francisco', 'America/Los_Angeles', 12, time '08:30', 2, 40, 80000,
        'A fund or bank that serves early-stage startups.'),
    (3, 'd0000000-0000-4000-8000-000000000003', 'Payments x AI Roundtable',
        'Fintech', 'Compare how fintech teams use AI for fraud and support.', 'roundtable',
        'San Francisco', 'America/Los_Angeles', 16, time '17:30', 2, 60, 200000,
        'A fintech or security company with a practitioner to moderate.'),
    (4, 'd0000000-0000-4000-8000-000000000004', 'Founders Supper: Hospitality Tech',
        'Hospitality technology', 'A dinner for operators and founders who build for restaurants.', 'dinner',
        'San Francisco', 'America/Los_Angeles', 20, time '19:00', 3, 30, 450000,
        'A company that sells to restaurants or hotels and can co-sponsor dinner.'),
    (5, 'd0000000-0000-4000-8000-000000000005', 'Robot Build Day',
        'Robotics', 'A hands-on build day for hobbyists and hardware engineers.', 'workshop',
        'Oakland', 'America/Los_Angeles', 23, time '10:00', 6, 60, 120000,
        'A hardware or robotics company that can lend kits or mentors.'),
    (6, 'd0000000-0000-4000-8000-000000000006', 'LLM Evals Meetup',
        'Machine learning', 'Talks on how teams test and measure language models.', 'meetup',
        'New York', 'America/New_York', 11, time '18:30', 3, 120, 250000,
        'A company with a venue in Manhattan or Brooklyn for 120 people.'),
    (7, 'd0000000-0000-4000-8000-000000000006', 'Open Weights Reading Group',
        'Machine learning research', 'Read and discuss one recent open-weights model paper.', 'reading group',
        'New York', 'America/New_York', 25, time '18:00', 2, 35, 50000,
        'A research lab or AI company that can bring an author.'),
    (8, 'd0000000-0000-4000-8000-000000000007', 'Platform Engineering Day',
        'Cloud infrastructure', 'Share how platform teams cut deploy time and cloud cost.', 'conference',
        'Austin', 'America/Chicago', 18, time '09:00', 8, 200, 900000,
        'A cloud or observability company that can sponsor lunch and one talk.'),
    (9, 'd0000000-0000-4000-8000-000000000008', 'Open Source Contribution Night',
        'Open source', 'Help students land their first merged pull request.', 'hack night',
        'Berkeley', 'America/Los_Angeles', 14, time '18:00', 3, 70, 60000,
        'An open-source company whose maintainers can review pull requests live.'),
    (10, 'd0000000-0000-4000-8000-000000000001', 'Design Engineers Show and Tell',
        'Design engineering', 'Designers and engineers show small tools they built.', 'show and tell',
        'San Francisco', 'America/Los_Angeles', 30, time '18:30', 2, 50, 100000,
        'A design tool company that can bring a speaker and snacks.')
  ) as e (n, owner, title, topic, goal, format, city, tz, in_days, start_at, hours, guests, budget_cents,
          partner_criteria)
on conflict (owner_id, source_tool_call_id) do update
  set date_start = excluded.date_start, date_end = excluded.date_end;
