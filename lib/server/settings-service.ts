import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { isMockMode, env } from "./env";
import { adminClient } from "./supabase";
import type { ActivityScheduleDto, SettingsDto } from "@/lib/domain/settings";
import { schedulesOverlap, validateSchedule } from "@/lib/domain/activity-policy";
import { setMockPin } from "./mock-store";

type Invitation = { id: string; email: string; role: "admin" | "teacher"; status: string; issuedAt: string };
const globalState = globalThis as typeof globalThis & { __hguniSettings?: { pinConfigured: boolean; schedules: ActivityScheduleDto[]; invitations: Invitation[]; reduceTransparency: boolean } };
globalState.__hguniSettings ??= { pinConfigured: true, reduceTransparency: false, invitations: [], schedules: [{ id: "mock-schedule-morning", name: "아침 등교지도", weekdays: [1,2,3,4,5], startLocal: "07:40", endLocal: "08:30", enabled: true, allowedItemKeys: ["D:UNIFORM","D:PROXY","D:LATE"] }] };
const mock = globalState.__hguniSettings;

function readiness(settings: Omit<SettingsDto, "readiness">): SettingsDto["readiness"] {
  return [
    { key: "bridge", label: "학교 PC 연결", ready: settings.bridge.online && settings.bridge.sqlReady, detail: settings.bridge.online ? "시험 중계가 연결되어 있습니다." : "중계 연결이 필요합니다." },
    { key: "catalog", label: "학생·항목 동기화", ready: Boolean(settings.bridge.catalogSyncedAt), detail: settings.bridge.catalogSyncedAt ? `마지막 동기화 ${new Date(settings.bridge.catalogSyncedAt).toLocaleString("ko-KR")}` : "목록 동기화가 필요합니다." },
    { key: "teacher", label: "담당교사", ready: Boolean(settings.teacherSourceId), detail: settings.teacherSourceId ? "부과 교사가 연결되어 있습니다." : "원본 담당교사를 선택하세요." },
    { key: "schedule", label: "활동시간", ready: settings.schedules.some((item) => item.enabled), detail: settings.schedules.some((item) => item.enabled) ? "사용할 활동이 설정되어 있습니다." : "활동시간을 저장하세요." },
    { key: "pin", label: "활동 PIN", ready: settings.pinConfigured, detail: settings.pinConfigured ? "PIN이 설정되어 있습니다." : "6자리 PIN을 설정하세요." },
  ];
}

export async function getSettings(): Promise<SettingsDto> {
  if (isMockMode()) {
    const value = { timezone: "Asia/Seoul" as const, settingsVersion: 1, teacherSourceId: "T-MOCK-01", pinConfigured: mock.pinConfigured, schedules: mock.schedules, sourceTeachers: [{id:"T-MOCK-01",name:"김담당",active:true}], penaltyItems: [{key:"D:UNIFORM",label:"복장불량",signedPoints:-2,enabled:true},{key:"D:PROXY",label:"대리출석",signedPoints:-3,enabled:true},{key:"D:LATE",label:"지각",signedPoints:-1,enabled:true}], paused: false, bridge: { online: true, sqlReady: true, catalogSyncedAt: new Date().toISOString(), penaltyReady: true, cancellationReady: true } };
    return { ...value, readiness: readiness(value) };
  }
  const client = adminClient();
  const [{ data: settings, error }, { data: schedules }, { data: scheduleItems }, { data: bridge }, { data: catalog }, { data: sourceTeachers }, { data: penaltyItems }] = await Promise.all([
    client.from("app_settings").select("timezone,pin_hash,settings_version,teacher_source_id,paused").eq("id", 1).single(),
    client.from("activity_schedules").select("id,name,weekdays,start_local,end_local,enabled").order("start_local"),
    client.from("schedule_items").select("schedule_id,source_kind,source_code"),
    client.from("bridge_instances").select("last_seen_at,sql_checked_at,capabilities").eq("enabled", true).order("last_seen_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("catalog_versions").select("synced_at").eq("status", "active").order("synced_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("source_teachers").select("source_id,name,active,catalog_versions!inner(status)").eq("catalog_versions.status","active").order("name"),
    client.from("penalty_items").select("kind,code,label,signed_points,enabled,catalog_versions!inner(status)").eq("catalog_versions.status","active").eq("kind","D").order("code"),
  ]);
  if (error || !settings) throw new Error(error?.message ?? "설정을 불러오지 못했습니다.");
  const online = Boolean(bridge && Date.now() - Date.parse(bridge.last_seen_at) <= 30_000);
  const sqlReady = Boolean(bridge?.sql_checked_at && Date.now() - Date.parse(bridge.sql_checked_at) <= 30_000);
  const value = {
    timezone: "Asia/Seoul" as const,
    settingsVersion: settings.settings_version,
    teacherSourceId: settings.teacher_source_id,
    pinConfigured: Boolean(settings.pin_hash),
    schedules: (schedules ?? []).map((item) => ({ id: item.id, name: item.name, weekdays: item.weekdays, startLocal: item.start_local.slice(0,5), endLocal: item.end_local.slice(0,5), enabled: item.enabled, allowedItemKeys: (scheduleItems??[]).filter((entry)=>entry.schedule_id===item.id).map((entry)=>`${entry.source_kind}:${entry.source_code}`) })),
    sourceTeachers: (sourceTeachers??[]).map((item)=>({id:item.source_id,name:item.name,active:item.active})),
    penaltyItems: (penaltyItems??[]).map((item)=>({key:`${item.kind}:${item.code}`,label:item.label,signedPoints:Number(item.signed_points),enabled:item.enabled})),
    paused: settings.paused,
    bridge: { online, sqlReady, catalogSyncedAt: catalog?.synced_at ?? null, penaltyReady: Boolean(bridge?.capabilities?.penalty), cancellationReady: Boolean(bridge?.capabilities?.cancellation) },
  };
  return { ...value, readiness: readiness(value) };
}

export async function addSchedule(input: Omit<ActivityScheduleDto, "id">) {
  validateSchedule(input);
  const current = await getSettings();
  if (current.schedules.filter((item) => item.enabled && input.enabled).some((item) => schedulesOverlap(item, input))) throw new Error("SCHEDULE_OVERLAP");
  if (isMockMode()) { const value = { ...input, id: randomUUID() }; mock.schedules.push(value); return value; }
  const client=adminClient();
  const { data, error } = await client.from("activity_schedules").insert({ name: input.name, weekdays: input.weekdays, start_local: input.startLocal, end_local: input.endLocal, enabled: input.enabled }).select("id,name,weekdays,start_local,end_local,enabled").single();
  if (error) throw new Error(error.message);
  const {error:itemError}=await client.from("schedule_items").insert(input.allowedItemKeys.map((key)=>({schedule_id:data.id,source_kind:"D",source_code:key.slice(2)})));if(itemError){await client.from("activity_schedules").delete().eq("id",data.id);throw new Error(itemError.message);}
  return { id: data.id, name: data.name, weekdays: data.weekdays, startLocal: data.start_local.slice(0,5), endLocal: data.end_local.slice(0,5), enabled: data.enabled, allowedItemKeys: input.allowedItemKeys } as ActivityScheduleDto;
}

export async function updateSettings(input:{settingsVersion:number;teacherSourceId?:string|null;paused?:boolean}){
  if(isMockMode())return {...input,settingsVersion:input.settingsVersion+1};
  const client=adminClient();
  if(input.teacherSourceId){const{data}=await client.from("source_teachers").select("source_id,catalog_versions!inner(status)").eq("source_id",input.teacherSourceId).eq("active",true).eq("catalog_versions.status","active").limit(1).maybeSingle();if(!data)throw new Error("TEACHER_SOURCE_INVALID");}
  if(input.paused===false){const current=await getSettings();if(current.readiness.some((item)=>!item.ready&&item.key!=="teacher")||!input.teacherSourceId&&!current.teacherSourceId)throw new Error("NOT_READY");}
  const update:Record<string,unknown>={settings_version:input.settingsVersion+1,updated_at:new Date().toISOString()};if(input.teacherSourceId!==undefined)update.teacher_source_id=input.teacherSourceId;if(input.paused!==undefined)update.paused=input.paused;
  const{data,error}=await client.from("app_settings").update(update).eq("id",1).eq("settings_version",input.settingsVersion).select("settings_version").maybeSingle();if(error)throw error;if(!data)throw new Error("SETTINGS_CONFLICT");return{...input,settingsVersion:data.settings_version};
}

export async function changePin(pin: string, actorId: string) {
  if (isMockMode()) { mock.pinConfigured = true; setMockPin(pin); return; }
  const config = env();
  if (!config.PIN_PEPPER) throw new Error("PIN_PEPPER가 설정되지 않았습니다.");
  const pinHash = await argon2.hash(`${pin}:${config.PIN_PEPPER}`);
  const { error } = await adminClient().rpc("hguni_change_pin", { p_pin_hash: pinHash, p_actor_id: actorId });
  if (error) throw new Error(error.message);
}

export async function listInvitations(): Promise<Invitation[]> {
  if (isMockMode()) return [...mock.invitations];
  const { data, error } = await adminClient().from("teacher_invitations").select("id,normalized_email,role,status,issued_at").order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({ id: row.id, email: row.normalized_email, role: row.role, status: row.status, issuedAt: row.issued_at }));
}

export async function inviteTeacher(email: string, role: "admin" | "teacher", invitedBy: string) {
  const normalized = email.trim().toLowerCase();
  if (isMockMode()) { const value = { id: randomUUID(), email: normalized, role, status: "pending", issuedAt: new Date().toISOString() }; mock.invitations.unshift(value); return value; }
  const client = adminClient();
  const issuedAt = new Date(); const expiresAt = new Date(issuedAt.getTime() + 60 * 60_000);
  const { data: row, error: insertError } = await client.from("teacher_invitations").insert({ normalized_email: normalized, role, invited_by: invitedBy, status: "pending", issued_at: issuedAt.toISOString(), expires_at: expiresAt.toISOString() }).select("id").single();
  if (insertError) throw new Error(insertError.message);
  const { data, error } = await client.auth.admin.inviteUserByEmail(normalized, { redirectTo: `${env().APP_BASE_URL}/teacher/accept-invite?invitation=${encodeURIComponent(row.id)}`, data: { invitation_id: row.id } });
  if (error) { await client.from("teacher_invitations").update({ status: "delivery_failed" }).eq("id", row.id); throw new Error(error.message); }
  await client.from("teacher_invitations").update({ provider_user_id: data.user?.id ?? null }).eq("id", row.id);
  return { id: row.id, email: normalized, role, status: "pending", issuedAt: issuedAt.toISOString() } as Invitation;
}
