-- Publish approval gate (SUP-25).
-- Each co-host approves one exact version of the launch content, identified by
-- content_hash. A publish job is created once both have approved that hash,
-- and the Luma package is emailed to the organizer exactly once per hash.

create table if not exists public.publish_approvals (
  launch_package_id uuid not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  party text not null check (party in ('company', 'community')),
  approved_by uuid not null references auth.users (id) on delete cascade,
  approved_at timestamptz not null default now(),
  primary key (launch_package_id, content_hash, party)
);

create table if not exists public.publish_jobs (
  launch_package_id uuid not null,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  organizer_email text not null,
  agentmail_message_id text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (launch_package_id, content_hash)
);

-- Server code (service role) checks co-host membership and writes these.
-- No policies: users cannot record approvals or jobs directly.
alter table public.publish_approvals enable row level security;
alter table public.publish_jobs enable row level security;
revoke all on public.publish_approvals, public.publish_jobs from anon, authenticated;

notify pgrst, 'reload schema';
