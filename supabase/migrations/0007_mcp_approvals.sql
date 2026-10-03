-- MCP approvals, agent tokens, and the audit log the agent writes (SUP-17).
-- audit_log matches SUP-16. Created here with IF NOT EXISTS so either migration
-- can land first. Do not change the column meanings if SUP-16 already created it.
--
-- The agent uses the user's JWT, so RLS cannot tell an agent from the human.
-- Consequential tools only insert status = 'pending'. Moving a row forward goes
-- through decide_approval / complete_approval, which the MCP tools do not call.

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  actor text not null check (actor in ('agent', 'human', 'system')),
  action text not null,
  outcome text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_log_user_created_idx
  on public.audit_log (user_id, created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists audit_log_select_own on public.audit_log;
create policy audit_log_select_own on public.audit_log
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.audit_log from anon, authenticated, public;
grant select on public.audit_log to authenticated;

-- Inserts go through this function so a user-scoped client can write a row
-- for itself without a service-role key on the tool path.
create or replace function public.write_audit_log(
  p_event_id uuid,
  p_actor text,
  p_action text,
  p_outcome text,
  p_detail jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.';
  end if;
  if p_actor not in ('agent', 'human', 'system') then
    raise exception 'Invalid actor.';
  end if;

  insert into public.audit_log (user_id, event_id, actor, action, outcome, detail)
  values (auth.uid(), p_event_id, p_actor, p_action, p_outcome, coalesce(p_detail, '{}'::jsonb))
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.write_audit_log(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.write_audit_log(uuid, text, text, text, jsonb) to authenticated;

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event_id uuid references public.events (id) on delete cascade,
  action text not null check (char_length(action) between 1 and 80),
  exact_scope jsonb not null default '{}',
  credits integer check (credits is null or credits >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'executed')),
  requested_by text not null check (requested_by in ('agent', 'human')),
  decided_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);

create index approvals_user_status_idx on public.approvals (user_id, status);
create index approvals_event_id_idx on public.approvals (event_id);

alter table public.approvals enable row level security;

create policy approvals_select_own on public.approvals
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy approvals_insert_pending on public.approvals
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and status = 'pending'
    and requested_by in ('agent', 'human')
  );

revoke all on public.approvals from anon, authenticated, public;
grant select, insert on public.approvals to authenticated;

create or replace function public.decide_approval(p_id uuid, p_decision text)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.approvals;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  update public.approvals
     set status = p_decision,
         decided_at = now()
   where id = p_id
     and user_id = auth.uid()
     and status = 'pending'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Approval not found or already decided.';
  end if;

  return v_row;
end;
$$;

revoke all on function public.decide_approval(uuid, text) from public, anon;
grant execute on function public.decide_approval(uuid, text) to authenticated;

-- Only an approved row can be marked executed, and only by its owner.
create or replace function public.complete_approval(p_id uuid, p_result jsonb)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.approvals;
begin
  if auth.uid() is null then
    raise exception 'Sign in to continue.';
  end if;

  update public.approvals
     set status = 'executed',
         result = coalesce(p_result, '{}'::jsonb)
   where id = p_id
     and user_id = auth.uid()
     and status = 'approved'
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Approval not found or not approved.';
  end if;

  return v_row;
end;
$$;

revoke all on function public.complete_approval(uuid, jsonb) from public, anon;
grant execute on function public.complete_approval(uuid, jsonb) to authenticated;

-- Fallback when OAuth is not set up. The plaintext token is shown once;
-- only the hash is stored. Lookup uses the service role, then the server
-- mints a normal user session so tool calls still run under RLS.
create table public.agent_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index agent_tokens_user_id_idx on public.agent_tokens (user_id);

alter table public.agent_tokens enable row level security;

create policy agent_tokens_select_own on public.agent_tokens
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy agent_tokens_insert_own on public.agent_tokens
  for insert to authenticated
  with check ((select auth.uid()) = user_id and revoked_at is null);

create policy agent_tokens_revoke_own on public.agent_tokens
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and revoked_at is not null);

revoke all on public.agent_tokens from anon, authenticated, public;
grant select, insert, update on public.agent_tokens to authenticated;

notify pgrst, 'reload schema';
