begin;

create type public.catalog_status as enum ('uploading', 'active', 'superseded', 'failed');

create table public.catalog_versions (
  id uuid primary key default gen_random_uuid(),
  source_scope text not null,
  synced_at timestamptz not null default now(),
  status public.catalog_status not null default 'uploading',
  counts jsonb not null default '{}'::jsonb,
  checksum char(64) not null,
  created_at timestamptz not null default now()
);
create unique index one_active_catalog_per_scope on public.catalog_versions(source_scope) where status = 'active';

create table public.students (
  catalog_version uuid not null references public.catalog_versions(id) on delete cascade,
  source_id text not null,
  name text not null,
  grade smallint not null check (grade between 1 and 6),
  class_label text not null,
  number smallint not null check (number > 0),
  source_class text not null,
  active boolean not null,
  primary key (catalog_version, source_id)
);
create index students_search on public.students(catalog_version, name text_pattern_ops);

create table public.penalty_items (
  catalog_version uuid not null references public.catalog_versions(id) on delete cascade,
  kind char(1) not null check (kind = 'D'),
  code text not null,
  label text not null,
  signed_points numeric(8,2) not null,
  enabled boolean not null,
  primary key (catalog_version, kind, code)
);

create table public.source_teachers (
  catalog_version uuid not null references public.catalog_versions(id) on delete cascade,
  source_id text not null,
  name text not null,
  active boolean not null,
  primary key (catalog_version, source_id)
);

commit;
