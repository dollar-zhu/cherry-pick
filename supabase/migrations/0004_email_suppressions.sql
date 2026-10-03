-- Do-not-contact list for outreach email (SUP-20).
-- One row per address, platform-wide: every outreach email is sent from the
-- same AgentMail inbox, so an unsubscribe, hard bounce or spam complaint
-- stops all future outreach to that address.

create table if not exists public.email_suppressions (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  reason text not null check (reason in ('unsubscribed', 'bounced', 'complained')),
  created_at timestamptz not null default now()
);

-- Written and read only by trusted server code (service role). No policies:
-- signed-in users cannot read who has unsubscribed.
alter table public.email_suppressions enable row level security;
revoke all on public.email_suppressions from anon, authenticated;

notify pgrst, 'reload schema';
