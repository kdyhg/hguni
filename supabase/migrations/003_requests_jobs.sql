begin;

create type public.penalty_request_state as enum ('queued','executing','succeeded','failed_safe','uncertain','expired_unsent','cancel_requested','cancel_approved','cancel_succeeded','cancel_manual_required');
create type public.job_operation as enum ('penalty','cancel');
create type public.job_state as enum ('queued','leased','authorized','reported','expired','blocked','uncertain');

create table public.penalty_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  session_id uuid not null references public.council_sessions(id),
  roster_id uuid not null references public.session_rosters(id),
  occurrence_id uuid not null references public.activity_occurrences(id),
  student_id text not null,
  item_key text not null,
  snapshot_json jsonb not null,
  payload_hash char(64) not null,
  state public.penalty_request_state not null default 'queued',
  execute_before timestamptz not null,
  source_record_id text,
  result_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (occurrence_id, student_id, item_key)
);
create index penalty_queue_idx on public.penalty_requests(state, execute_before, created_at);
create index penalty_history_idx on public.penalty_requests(occurrence_id, created_at desc);

create table public.cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  penalty_request_id uuid not null references public.penalty_requests(id),
  reason text not null check (char_length(trim(reason)) between 2 and 300),
  requested_by text not null,
  approved_by uuid references public.teacher_profiles(auth_user_id),
  state text not null check (state in ('requested','approved','rejected','executing','succeeded','manual_required','uncertain')),
  result_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_active_cancellation on public.cancellation_requests(penalty_request_id) where state in ('requested','approved','executing','uncertain');

create table public.bridge_jobs (
  id uuid primary key default gen_random_uuid(),
  operation public.job_operation not null,
  request_id uuid not null,
  state public.job_state not null default 'queued',
  lease_owner uuid,
  lease_generation integer not null default 0,
  lease_until timestamptz,
  attempt_count integer not null default 0,
  execute_before timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, operation)
);
create index bridge_jobs_claim_idx on public.bridge_jobs(state, execute_before, created_at);

create table public.bridge_instances (
  id uuid primary key default gen_random_uuid(),
  token_hash char(64) not null unique,
  enabled boolean not null default true,
  last_seen_at timestamptz,
  sql_checked_at timestamptz,
  capabilities jsonb not null default '{}'::jsonb,
  version text,
  scope text not null,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('system','council','teacher','bridge')),
  actor_id text,
  action text not null,
  target_id text,
  redacted_detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_target_idx on public.audit_events(target_id, created_at desc);

create table public.pin_attempt_buckets (
  bucket_hash char(64) primary key,
  window_start timestamptz not null,
  fail_count integer not null default 0,
  blocked_until timestamptz
);

commit;
