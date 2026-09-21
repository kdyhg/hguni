begin;

create schema if not exists app_private;

create or replace function app_private.current_occurrence()
returns public.activity_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.activity_schedules;
  v_settings public.app_settings;
  v_local_now timestamp;
  v_local_date date;
  v_starts timestamptz;
  v_ends timestamptz;
  v_occurrence public.activity_occurrences;
begin
  select * into v_settings from public.app_settings where id=1;
  if v_settings.paused or v_settings.teacher_source_id is null
    or not exists(select 1 from public.bridge_instances b where b.enabled and b.scope=current_setting('app.source_scope',true) and b.last_seen_at>now()-interval '30 seconds' and b.sql_checked_at>now()-interval '30 seconds' and coalesce((b.capabilities->>'penalty')::boolean,false))
    or not exists(select 1 from public.catalog_versions c where c.status='active' and c.synced_at>now()-interval '24 hours') then return null; end if;
  v_local_now := timezone('Asia/Seoul', now());
  v_local_date := v_local_now::date;
  select * into v_schedule
  from public.activity_schedules s
  where s.enabled
    and extract(dow from v_local_now)::smallint = any(s.weekdays)
    and v_local_now::time >= s.start_local
    and v_local_now::time < s.end_local
  order by s.start_local
  limit 1;

  if not found then return null; end if;
  v_starts := (v_local_date + v_schedule.start_local) at time zone 'Asia/Seoul';
  v_ends := (v_local_date + v_schedule.end_local) at time zone 'Asia/Seoul';

  insert into public.activity_occurrences(schedule_id, local_date, starts_at, ends_at, status, config_snapshot)
  values (
    v_schedule.id, v_local_date, v_starts, v_ends, 'active',
    jsonb_build_object(
      'name', v_schedule.name,
      'scheduleVersion', v_schedule.version,
      'teacherSourceId', (select teacher_source_id from public.app_settings where id = 1),
      'itemKeys', (select coalesce(jsonb_agg(si.source_kind || ':' || si.source_code order by si.source_code), '[]'::jsonb) from public.schedule_items si where si.schedule_id = v_schedule.id)
    )
  )
  on conflict (schedule_id, local_date) do nothing;

  select * into v_occurrence from public.activity_occurrences o where o.schedule_id = v_schedule.id and o.local_date = v_local_date;
  return v_occurrence;
end;
$$;

create or replace function app_private.require_session(p_token_hash text)
returns public.council_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.council_sessions;
begin
  select s.* into v_session from public.council_sessions s
  join public.activity_occurrences o on o.id = s.occurrence_id
  join public.app_settings a on a.id = 1
  where s.token_hash = p_token_hash
    and s.revoked_at is null
    and s.expires_at > now()
    and s.pin_version = a.pin_version
    and o.status = 'active'
    and o.ends_at > now()
    and not a.paused;
  if not found then raise exception 'SESSION_INVALID'; end if;
  return v_session;
end;
$$;

create or replace function app_private.record_json(p_request_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'requestId', p.request_id,
    'student', p.snapshot_json->'student',
    'item', p.snapshot_json->'item',
    'roster', p.snapshot_json->'roster',
    'state', p.state,
    'createdAt', p.created_at,
    'message', coalesce(c.reason, p.result_json->>'message'),
    'cancellationId', c.id
  )
  from public.penalty_requests p
  left join lateral (
    select cr.id, cr.reason from public.cancellation_requests cr
    where cr.penalty_request_id = p.id order by cr.created_at desc limit 1
  ) c on true
  where p.request_id = p_request_id
$$;

create or replace function public.hguni_council_status(p_token_hash text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.activity_occurrences;
  v_session public.council_sessions;
  v_schedule public.activity_schedules;
  v_settings public.app_settings;
  v_local_now timestamp;
  v_roster jsonb := '[]'::jsonb;
  v_bridge_ready boolean := false;
  v_catalog_ready boolean := false;
  v_reason text;
begin
  select * into v_settings from public.app_settings where id = 1;
  v_local_now := timezone('Asia/Seoul',now());
  select * into v_schedule from public.activity_schedules s where s.enabled and extract(dow from v_local_now)::smallint=any(s.weekdays) and v_local_now::time>=s.start_local and v_local_now::time<s.end_local order by s.start_local limit 1;
  select exists(select 1 from public.bridge_instances b where b.enabled and b.scope = current_setting('app.source_scope', true) and b.last_seen_at > now() - interval '30 seconds' and b.sql_checked_at > now() - interval '30 seconds' and coalesce((b.capabilities->>'penalty')::boolean, false)) into v_bridge_ready;
  select exists(select 1 from public.catalog_versions c where c.status = 'active' and c.synced_at > now() - interval '24 hours') into v_catalog_ready;

  if v_schedule.id is null then v_reason := 'outside_hours';
  elsif v_settings.paused or not v_bridge_ready then v_reason := 'bridge_offline';
  elsif v_settings.teacher_source_id is null then v_reason := 'teacher_missing';
  elsif not v_catalog_ready then v_reason := 'catalog_missing';
  end if;
  if v_reason is null then v_occurrence := app_private.current_occurrence(); end if;

  if p_token_hash is not null then
    select * into v_session from public.council_sessions s where s.token_hash = p_token_hash and s.revoked_at is null and s.expires_at > now() and s.pin_version = v_settings.pin_version;
    if found then select sr.names_json into v_roster from public.session_rosters sr where sr.session_id = v_session.id order by sr.version desc limit 1; end if;
  end if;

  return jsonb_build_object(
    'mode', 'live',
    'activity', case when v_schedule.id is null then null else jsonb_build_object('id', coalesce(v_occurrence.id,v_schedule.id), 'name', v_schedule.name, 'startsAt', to_char(v_schedule.start_local,'HH24:MI'), 'endsAt',to_char(v_schedule.end_local,'HH24:MI')) end,
    'lockReason', v_reason,
    'session', jsonb_build_object('unlocked', v_session.id is not null and v_reason is null, 'roster', coalesce(v_roster,'[]'::jsonb)),
    'bridgeReady', v_bridge_ready
  );
end;
$$;

create or replace function public.hguni_check_pin_attempt(p_bucket_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_bucket public.pin_attempt_buckets;
begin
  select * into v_bucket from public.pin_attempt_buckets where bucket_hash = p_bucket_hash;
  return jsonb_build_object('allowed', v_bucket.blocked_until is null or v_bucket.blocked_until <= now(), 'retry_after', greatest(0, extract(epoch from coalesce(v_bucket.blocked_until,now()) - now())::int));
end;
$$;

create or replace function public.hguni_record_pin_failure(p_bucket_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.pin_attempt_buckets(bucket_hash, window_start, fail_count)
  values (p_bucket_hash, now(), 1)
  on conflict (bucket_hash) do update set
    window_start = case when public.pin_attempt_buckets.window_start < now() - interval '5 minutes' then now() else public.pin_attempt_buckets.window_start end,
    fail_count = case when public.pin_attempt_buckets.window_start < now() - interval '5 minutes' then 1 else public.pin_attempt_buckets.fail_count + 1 end,
    blocked_until = case when (case when public.pin_attempt_buckets.window_start < now() - interval '5 minutes' then 1 else public.pin_attempt_buckets.fail_count + 1 end) >= 5 then now() + interval '5 minutes' else public.pin_attempt_buckets.blocked_until end;
end;
$$;

create or replace function public.hguni_open_council_session(p_token_hash text, p_pin_version integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_occurrence public.activity_occurrences; v_settings public.app_settings;
begin
  select * into v_settings from public.app_settings where id = 1 for update;
  if v_settings.pin_version <> p_pin_version or v_settings.paused then raise exception 'PIN_INVALID'; end if;
  v_occurrence := app_private.current_occurrence();
  if v_occurrence.id is null then raise exception 'ACTIVITY_CLOSED'; end if;
  insert into public.council_sessions(token_hash, occurrence_id, pin_version, expires_at) values (p_token_hash, v_occurrence.id, p_pin_version, v_occurrence.ends_at);
  insert into public.audit_events(actor_type, action, target_id) values ('council','session.opened',v_occurrence.id::text);
  return v_occurrence.ends_at;
end;
$$;

create or replace function public.hguni_set_roster(p_token_hash text, p_names text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.council_sessions; v_version integer; v_names jsonb;
begin
  v_session := app_private.require_session(p_token_hash);
  if cardinality(p_names) not between 1 and 10 or exists(select 1 from unnest(p_names) n where char_length(trim(n)) not between 1 and 30) or cardinality(p_names) <> (select count(distinct trim(n)) from unnest(p_names) n) then raise exception 'INVALID_ROSTER'; end if;
  select coalesce(max(version),0)+1 into v_version from public.session_rosters where session_id = v_session.id;
  select jsonb_agg(trim(n) order by ord) into v_names from unnest(p_names) with ordinality t(n,ord);
  insert into public.session_rosters(session_id,version,names_json) values(v_session.id,v_version,v_names);
  insert into public.audit_events(actor_type,actor_id,action,target_id,redacted_detail) values('council',v_session.id::text,'roster.updated',v_session.occurrence_id::text,jsonb_build_object('count',cardinality(p_names),'version',v_version));
  return v_names;
end;
$$;

create or replace function public.hguni_search_students(p_token_hash text, p_query text, p_limit integer default 20)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.council_sessions; v_catalog uuid; v_result jsonb;
begin
  v_session := app_private.require_session(p_token_hash);
  if char_length(trim(p_query)) < 2 then return '[]'::jsonb; end if;
  select id into v_catalog from public.catalog_versions where status='active' order by synced_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.source_id,'name',s.name,'grade',s.grade,'classLabel',s.class_label,'number',s.number,'sourceClass',s.source_class,'active',s.active) order by s.name,s.grade,s.class_label,s.number),'[]'::jsonb) into v_result
  from (select * from public.students where catalog_version=v_catalog and active and (name ilike '%'||trim(p_query)||'%' or source_id ilike '%'||trim(p_query)||'%') order by name,grade,class_label,number limit least(p_limit,20)) s;
  return v_result;
end;
$$;

create or replace function public.hguni_current_items(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.council_sessions; v_catalog uuid; v_items jsonb;
begin
  v_session := app_private.require_session(p_token_hash);
  select id into v_catalog from public.catalog_versions where status='active' order by synced_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('key',i.kind||':'||i.code,'kind',i.kind,'code',i.code,'label',i.label,'signedPoints',i.signed_points,'enabled',i.enabled) order by i.code),'[]'::jsonb) into v_items
  from public.penalty_items i join public.schedule_items si on si.source_kind=i.kind and si.source_code=i.code join public.activity_occurrences o on o.schedule_id=si.schedule_id
  where i.catalog_version=v_catalog and i.enabled and o.id=v_session.occurrence_id;
  return jsonb_build_object('version',v_catalog,'items',v_items);
end;
$$;

create or replace function public.hguni_accept_penalty(p_token_hash text,p_request_id uuid,p_student_id text,p_item_key text,p_catalog_version text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.council_sessions; v_roster public.session_rosters; v_occurrence public.activity_occurrences; v_student public.students; v_item public.penalty_items; v_request public.penalty_requests; v_hash text; v_execute_before timestamptz;
begin
  v_session := app_private.require_session(p_token_hash);
  select * into v_roster from public.session_rosters where session_id=v_session.id order by version desc limit 1;
  if v_roster.id is null then raise exception 'ROSTER_REQUIRED'; end if;
  select * into v_occurrence from public.activity_occurrences where id=v_session.occurrence_id for update;
  select * into v_student from public.students where catalog_version=p_catalog_version::uuid and source_id=p_student_id and active;
  select * into v_item from public.penalty_items where catalog_version=p_catalog_version::uuid and (kind||':'||code)=p_item_key and kind='D' and enabled;
  if v_student.source_id is null or v_item.code is null then raise exception 'CATALOG_STALE'; end if;
  if not exists(select 1 from public.schedule_items where schedule_id=v_occurrence.schedule_id and source_kind=v_item.kind and source_code=v_item.code) then raise exception 'ITEM_NOT_ALLOWED'; end if;
  v_hash := encode(digest(jsonb_build_object('student',p_student_id,'item',p_item_key,'catalog',p_catalog_version,'occurrence',v_occurrence.id)::text,'sha256'),'hex');
  select * into v_request from public.penalty_requests where request_id=p_request_id;
  if found then
    if v_request.payload_hash<>v_hash or v_request.session_id<>v_session.id then raise exception 'REQUEST_ID_CONFLICT'; end if;
    return app_private.record_json(p_request_id);
  end if;
  v_execute_before := least(now()+interval '30 seconds',v_occurrence.ends_at);
  begin
    insert into public.penalty_requests(request_id,session_id,roster_id,occurrence_id,student_id,item_key,snapshot_json,payload_hash,execute_before)
    values(p_request_id,v_session.id,v_roster.id,v_occurrence.id,p_student_id,p_item_key,jsonb_build_object(
      'student',jsonb_build_object('id',v_student.source_id,'name',v_student.name,'grade',v_student.grade,'classLabel',v_student.class_label,'number',v_student.number,'sourceClass',v_student.source_class,'active',v_student.active),
      'item',jsonb_build_object('key',v_item.kind||':'||v_item.code,'kind',v_item.kind,'code',v_item.code,'label',v_item.label,'signedPoints',v_item.signed_points,'enabled',v_item.enabled),
      'roster',v_roster.names_json,
      'teacherSourceId',v_occurrence.config_snapshot->>'teacherSourceId',
      'sourceScope',current_setting('app.source_scope',true)
    ),v_hash,v_execute_before) returning * into v_request;
  exception when unique_violation then raise exception 'DUPLICATE_PENALTY'; end;
  insert into public.bridge_jobs(operation,request_id,execute_before) values('penalty',p_request_id,v_execute_before);
  insert into public.audit_events(actor_type,actor_id,action,target_id) values('council',v_session.id::text,'penalty.accepted',p_request_id::text);
  return app_private.record_json(p_request_id);
end;
$$;

create or replace function public.hguni_penalty_status(p_token_hash text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.council_sessions;
begin v_session:=app_private.require_session(p_token_hash); if not exists(select 1 from public.penalty_requests where request_id=p_request_id and session_id=v_session.id) then raise exception 'NOT_FOUND'; end if; return app_private.record_json(p_request_id); end;
$$;

create or replace function public.hguni_council_history(p_token_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.council_sessions; v_result jsonb;
begin v_session:=app_private.require_session(p_token_hash); select coalesce(jsonb_agg(app_private.record_json(p.request_id) order by p.created_at desc),'[]'::jsonb) into v_result from (select * from public.penalty_requests where session_id=v_session.id order by created_at desc limit 100) p; return v_result; end;
$$;

create or replace function public.hguni_request_cancellation(p_token_hash text,p_request_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_session public.council_sessions; v_request public.penalty_requests;
begin
  v_session:=app_private.require_session(p_token_hash); select * into v_request from public.penalty_requests where request_id=p_request_id and session_id=v_session.id for update;
  if v_request.id is null or v_request.state not in ('queued','executing','succeeded','uncertain') then raise exception 'CANCELLATION_INVALID'; end if;
  insert into public.cancellation_requests(penalty_request_id,reason,requested_by,state) values(v_request.id,trim(p_reason),v_session.id::text,'requested');
  update public.penalty_requests set state='cancel_requested',updated_at=now() where id=v_request.id;
  insert into public.audit_events(actor_type,actor_id,action,target_id) values('council',v_session.id::text,'cancellation.requested',p_request_id::text);
  return app_private.record_json(p_request_id);
end;
$$;

create or replace function public.hguni_end_council_session(p_token_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin update public.council_sessions set revoked_at=coalesce(revoked_at,now()) where token_hash=p_token_hash; end;
$$;

create or replace function public.hguni_teacher_history()
returns jsonb language sql security definer set search_path='' as $$
  select coalesce(jsonb_agg(app_private.record_json(p.request_id) order by p.created_at desc),'[]'::jsonb) from (select * from public.penalty_requests order by created_at desc limit 250) p
$$;

create or replace function public.hguni_approve_cancellation(p_request_id uuid,p_reason text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request public.penalty_requests; v_cancel public.cancellation_requests;
begin
  select * into v_request from public.penalty_requests where request_id=p_request_id for update;
  select * into v_cancel from public.cancellation_requests where penalty_request_id=v_request.id and state='requested' for update;
  if v_cancel.id is null then raise exception 'CANCELLATION_INVALID'; end if;
  update public.cancellation_requests set state='approved',approved_by=p_actor_id,updated_at=now(),reason=coalesce(nullif(trim(p_reason),''),reason) where id=v_cancel.id;
  update public.penalty_requests set state='cancel_approved',updated_at=now() where id=v_request.id;
  if exists(select 1 from public.bridge_jobs where request_id=p_request_id and operation='penalty' and state='queued') then
    update public.bridge_jobs set state='blocked',updated_at=now() where request_id=p_request_id and operation='penalty';
    update public.cancellation_requests set state='succeeded',result_json=jsonb_build_object('mode','unsent') where id=v_cancel.id;
    update public.penalty_requests set state='cancel_succeeded',updated_at=now() where id=v_request.id;
  else
    insert into public.bridge_jobs(operation,request_id,execute_before) values('cancel',v_cancel.id,now()+interval '24 hours') on conflict do nothing;
  end if;
  insert into public.audit_events(actor_type,actor_id,action,target_id) values('teacher',p_actor_id::text,'cancellation.approved',p_request_id::text);
  return app_private.record_json(p_request_id);
end;
$$;

create or replace function public.hguni_reject_cancellation(p_request_id uuid,p_reason text,p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_request public.penalty_requests; v_cancel public.cancellation_requests; v_previous public.penalty_request_state;
begin
  select * into v_request from public.penalty_requests where request_id=p_request_id for update;
  select * into v_cancel from public.cancellation_requests where penalty_request_id=v_request.id and state='requested' for update;
  if v_cancel.id is null then raise exception 'CANCELLATION_INVALID'; end if;
  v_previous:=case when v_request.source_record_id is not null then 'succeeded'::public.penalty_request_state else 'queued'::public.penalty_request_state end;
  update public.cancellation_requests set state='rejected',approved_by=p_actor_id,updated_at=now(),result_json=jsonb_build_object('reason',trim(p_reason)) where id=v_cancel.id;
  update public.penalty_requests set state=v_previous,updated_at=now() where id=v_request.id;
  insert into public.audit_events(actor_type,actor_id,action,target_id) values('teacher',p_actor_id::text,'cancellation.rejected',p_request_id::text);
  return app_private.record_json(p_request_id);
end;
$$;

create or replace function public.hguni_change_pin(p_pin_hash text,p_actor_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.app_settings set pin_hash=p_pin_hash,pin_version=pin_version+1,settings_version=settings_version+1,updated_at=now() where id=1;
  update public.council_sessions set revoked_at=coalesce(revoked_at,now()) where revoked_at is null;
  insert into public.audit_events(actor_type,actor_id,action) values('teacher',p_actor_id::text,'pin.changed');
end;
$$;

create or replace function public.hguni_claim_job(p_bridge_id uuid,p_lease_seconds integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.bridge_jobs; v_payload jsonb; v_request public.penalty_requests; v_cancel public.cancellation_requests; v_receipt_hash text;
begin
  select * into v_job from public.bridge_jobs j where (j.state='queued' or (j.state='leased' and j.lease_until<now())) and j.execute_before>now() order by j.created_at for update skip locked limit 1;
  if v_job.id is null then return null; end if;
  update public.bridge_jobs set state='leased',lease_owner=p_bridge_id,lease_generation=lease_generation+1,lease_until=now()+make_interval(secs=>least(greatest(p_lease_seconds,5),60)),attempt_count=attempt_count+1,updated_at=now() where id=v_job.id returning * into v_job;
  if v_job.operation='penalty' then
    select * into v_request from public.penalty_requests where request_id=v_job.request_id;
    v_receipt_hash:=v_request.payload_hash;
  else
    select * into v_cancel from public.cancellation_requests where id=v_job.request_id;
    select * into v_request from public.penalty_requests where id=v_cancel.penalty_request_id;
    v_receipt_hash:=encode(digest(v_job.request_id::text||':'||v_request.payload_hash,'sha256'),'hex');
  end if;
  select jsonb_build_object('jobId',v_job.id,'operation',v_job.operation,'requestId',v_job.request_id,'leaseGeneration',v_job.lease_generation,'leaseUntil',v_job.lease_until,'executeBefore',v_job.execute_before,'payload',v_request.snapshot_json,'payloadHash',v_receipt_hash,'sourceRecordId',v_request.source_record_id) into v_payload;
  return v_payload;
end;
$$;

create or replace function public.hguni_authorize_job(p_job_id uuid,p_bridge_id uuid,p_lease_generation integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_job public.bridge_jobs;
begin
  select * into v_job from public.bridge_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.state<>'leased' or v_job.lease_owner<>p_bridge_id or v_job.lease_generation<>p_lease_generation or v_job.lease_until<=now() or v_job.execute_before<=now() then return false; end if;
  update public.bridge_jobs set state='authorized',updated_at=now() where id=p_job_id;
  if v_job.operation='penalty' then
    update public.penalty_requests set state='executing',updated_at=now() where request_id=v_job.request_id;
  else
    update public.cancellation_requests set state='executing',updated_at=now() where id=v_job.request_id and state='approved';
  end if;
  return true;
end;
$$;

create or replace function public.hguni_report_job(p_job_id uuid,p_bridge_id uuid,p_lease_generation integer,p_outcome text,p_result jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_job public.bridge_jobs; v_state public.penalty_request_state; v_penalty_id uuid;
begin
  select * into v_job from public.bridge_jobs where id=p_job_id for update;
  if v_job.id is null or v_job.lease_owner<>p_bridge_id or v_job.lease_generation<>p_lease_generation then raise exception 'STALE_LEASE'; end if;
  if v_job.state='reported' then return; end if;
  v_state:=case when p_outcome='succeeded' and v_job.operation='penalty' then 'succeeded'::public.penalty_request_state when p_outcome='succeeded' then 'cancel_succeeded'::public.penalty_request_state when p_outcome='failed_safe' then 'failed_safe'::public.penalty_request_state when p_outcome='manual_required' then 'cancel_manual_required'::public.penalty_request_state else 'uncertain'::public.penalty_request_state end;
  update public.bridge_jobs set state=case when v_state='uncertain' then 'uncertain' else 'reported' end,updated_at=now() where id=p_job_id;
  if v_job.operation='penalty' then
    update public.penalty_requests set state=v_state,source_record_id=coalesce(p_result->>'sourceRecordId',source_record_id),result_json=p_result,updated_at=now() where request_id=v_job.request_id and state not in ('succeeded','cancel_succeeded');
  else
    select penalty_request_id into v_penalty_id from public.cancellation_requests where id=v_job.request_id;
    update public.penalty_requests set state=v_state,result_json=p_result,updated_at=now() where id=v_penalty_id and state not in ('cancel_succeeded');
    update public.cancellation_requests set state=case when v_state='cancel_succeeded' then 'succeeded' when v_state='cancel_manual_required' then 'manual_required' else 'uncertain' end,result_json=p_result,updated_at=now() where id=v_job.request_id and state in ('approved','executing','uncertain');
  end if;
end;
$$;

create or replace function public.hguni_reconcile_job(p_job_id uuid,p_bridge_id uuid,p_outcome text,p_result jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare v_job public.bridge_jobs; v_request public.penalty_requests; v_cancel public.cancellation_requests;
begin
  select * into v_job from public.bridge_jobs where id=p_job_id for update;
  if v_job.id is null then raise exception 'JOB_NOT_FOUND'; end if;
  if v_job.operation='penalty' then
    select * into v_request from public.penalty_requests where request_id=v_job.request_id for update;
  else
    select * into v_cancel from public.cancellation_requests where id=v_job.request_id for update;
    select * into v_request from public.penalty_requests where id=v_cancel.penalty_request_id for update;
  end if;
  if p_outcome='succeeded' then
    update public.bridge_jobs set state='reported',updated_at=now() where id=v_job.id;
    update public.penalty_requests set state=case when v_job.operation='penalty' then 'succeeded'::public.penalty_request_state else 'cancel_succeeded'::public.penalty_request_state end,source_record_id=coalesce(p_result->>'sourceRecordId',source_record_id),result_json=p_result,updated_at=now() where id=v_request.id and state not in ('succeeded','cancel_succeeded');
    if v_job.operation='cancel' then update public.cancellation_requests set state='succeeded',result_json=p_result,updated_at=now() where id=v_cancel.id; end if;
  elsif v_request.state not in ('succeeded','cancel_succeeded') then
    update public.bridge_jobs set state='uncertain',updated_at=now() where id=v_job.id;
    update public.penalty_requests set state='uncertain',result_json=p_result,updated_at=now() where id=v_request.id;
  end if;
  insert into public.audit_events(actor_type,actor_id,action,target_id,redacted_detail) values('bridge',p_bridge_id::text,'job.reconciled',v_job.request_id::text,jsonb_build_object('outcome',p_outcome,'operation',v_job.operation));
end;
$$;

create or replace function public.hguni_activate_catalog(p_catalog_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_scope text; v_expected jsonb; v_students integer; v_items integer; v_teachers integer;
begin
  select source_scope,counts into v_scope,v_expected from public.catalog_versions where id=p_catalog_id and status='uploading' for update;
  if v_scope is null then raise exception 'CATALOG_NOT_UPLOADING'; end if;
  select count(*) into v_students from public.students where catalog_version=p_catalog_id;
  select count(*) into v_items from public.penalty_items where catalog_version=p_catalog_id;
  select count(*) into v_teachers from public.source_teachers where catalog_version=p_catalog_id;
  if v_students<>coalesce((v_expected->>'students')::integer,-1) or v_items<>coalesce((v_expected->>'items')::integer,-1) or v_teachers<>coalesce((v_expected->>'teachers')::integer,-1) then raise exception 'CATALOG_COUNT_MISMATCH'; end if;
  update public.catalog_versions set status='superseded' where source_scope=v_scope and status='active';
  update public.catalog_versions set status='active',synced_at=now() where id=p_catalog_id;
  insert into public.audit_events(actor_type,action,target_id,redacted_detail) values('bridge','catalog.activated',p_catalog_id::text,v_expected);
end;
$$;

create or replace function public.hguni_accept_invitation(p_invitation_id uuid,p_user_id uuid,p_email text)
returns void language plpgsql security definer set search_path='' as $$
declare v_invitation public.teacher_invitations;
begin
  select * into v_invitation from public.teacher_invitations where id=p_invitation_id for update;
  if v_invitation.id is null or v_invitation.status<>'pending' or v_invitation.expires_at<=now() or v_invitation.normalized_email<>lower(trim(p_email)) or (v_invitation.provider_user_id is not null and v_invitation.provider_user_id<>p_user_id) then raise exception 'INVITATION_INVALID'; end if;
  insert into public.teacher_profiles(auth_user_id,email,role,enabled) values(p_user_id,lower(trim(p_email)),v_invitation.role,true)
  on conflict(auth_user_id) do update set email=excluded.email,enabled=true,updated_at=now();
  update public.teacher_invitations set status='accepted',provider_user_id=p_user_id,accepted_at=now() where id=p_invitation_id;
  insert into public.audit_events(actor_type,actor_id,action,target_id) values('teacher',p_user_id::text,'invitation.accepted',p_invitation_id::text);
end;
$$;

commit;
