begin;

create extension if not exists pgcrypto;

create type public.teacher_role as enum ('admin', 'teacher');
create type public.occurrence_status as enum ('scheduled', 'active', 'stopped', 'closed');

create table public.teacher_profiles (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role public.teacher_role not null default 'teacher',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_profiles_email_normalized check (email = lower(trim(email)))
);
create unique index teacher_profiles_email_unique on public.teacher_profiles (lower(email));

create table public.teacher_invitations (
  id uuid primary key default gen_random_uuid(),
  normalized_email text not null,
  role public.teacher_role not null default 'teacher',
  invited_by uuid not null references public.teacher_profiles(auth_user_id),
  provider_user_id uuid,
  status text not null check (status in ('pending','accepted','revoked','expired','delivery_failed')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint teacher_invitations_email_normalized check (normalized_email = lower(trim(normalized_email))),
  constraint teacher_invitations_expiry check (expires_at > issued_at)
);
create unique index one_pending_invitation_per_email on public.teacher_invitations(normalized_email) where status = 'pending';

create table public.app_settings (
  id smallint primary key default 1 check (id = 1),
  timezone text not null default 'Asia/Seoul' check (timezone = 'Asia/Seoul'),
  pin_hash text,
  pin_version integer not null default 1 check (pin_version > 0),
  settings_version bigint not null default 1 check (settings_version > 0),
  teacher_source_id text,
  paused boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.app_settings(id) values (1);

create table public.activity_schedules (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  weekdays smallint[] not null,
  start_local time not null,
  end_local time not null,
  enabled boolean not null default false,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_same_day check (start_local < end_local),
  constraint activity_weekdays check (cardinality(weekdays) between 1 and 7 and weekdays <@ array[0,1,2,3,4,5,6]::smallint[])
);

create table public.schedule_items (
  schedule_id uuid not null references public.activity_schedules(id) on delete cascade,
  source_kind char(1) not null check (source_kind = 'D'),
  source_code text not null,
  primary key (schedule_id, source_kind, source_code)
);

create table public.activity_occurrences (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.activity_schedules(id),
  local_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.occurrence_status not null default 'scheduled',
  config_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (schedule_id, local_date),
  constraint occurrence_time_order check (starts_at < ends_at)
);

create table public.council_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash char(64) not null unique,
  occurrence_id uuid not null references public.activity_occurrences(id),
  pin_version integer not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.session_rosters (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.council_sessions(id),
  version integer not null check (version > 0),
  names_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, version),
  constraint roster_is_array check (jsonb_typeof(names_json) = 'array')
);

commit;
