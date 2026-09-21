begin;

do $$
declare t text;
begin
  foreach t in array array[
    'teacher_profiles','teacher_invitations','app_settings','activity_schedules','schedule_items','activity_occurrences','council_sessions','session_rosters','catalog_versions','students','penalty_items','source_teachers','penalty_requests','cancellation_requests','bridge_jobs','bridge_instances','audit_events','pin_attempt_buckets'
  ] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('alter table public.%I force row level security',t);
    execute format('revoke all on table public.%I from anon, authenticated',t);
    execute format('grant all on table public.%I to service_role',t);
  end loop;
end $$;

revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke execute on all functions in schema app_private from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema app_private to service_role;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app_private revoke execute on functions from public, anon, authenticated;

create or replace function app_private.reject_overlapping_schedules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.app_settings where id=1 for update;
  if new.enabled and exists(
    select 1 from public.activity_schedules s
    where s.id<>new.id and s.enabled and s.weekdays && new.weekdays and s.start_local<new.end_local and new.start_local<s.end_local
  ) then raise exception 'SCHEDULE_OVERLAP'; end if;
  return new;
end;
$$;
create trigger activity_schedule_overlap before insert or update on public.activity_schedules for each row execute function app_private.reject_overlapping_schedules();

create or replace function app_private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role='admin' and old.enabled and (new.role<>'admin' or not new.enabled) and not exists(select 1 from public.teacher_profiles p where p.auth_user_id<>old.auth_user_id and p.role='admin' and p.enabled) then raise exception 'LAST_ADMIN_REQUIRED'; end if;
  return new;
end;
$$;
create trigger protect_last_admin before update on public.teacher_profiles for each row execute function app_private.protect_last_admin();

create or replace function app_private.audit_immutable()
returns trigger language plpgsql set search_path='' as $$ begin raise exception 'AUDIT_IMMUTABLE'; end; $$;
create trigger audit_events_no_update before update or delete on public.audit_events for each row execute function app_private.audit_immutable();

revoke execute on function app_private.reject_overlapping_schedules() from public, anon, authenticated;
revoke execute on function app_private.protect_last_admin() from public, anon, authenticated;
revoke execute on function app_private.audit_immutable() from public, anon, authenticated;

commit;
