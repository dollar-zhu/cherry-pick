-- Cherry Pick demo data: 18 fictional organizations (is_demo = true).
-- Run after all files in supabase/migrations/. Safe to run again: it replaces only demo rows.
-- Demo story: an AI company (speakers + $500, set in its event brief) needs an SF venue for a 50-person workshop,
-- then adds "Thursdays only". Comments mark which rows each constraint removes.
-- Weekdays: 0 = Sun ... 4 = Thu ... 6 = Sat.

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
