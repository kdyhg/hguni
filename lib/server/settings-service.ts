import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { isMockMode, env } from "./env";
import { audit, json, localDb } from "./local-db";
import type { ActivityScheduleDto, SettingsDto } from "@/lib/domain/settings";
import { schedulesOverlap, validateSchedule } from "@/lib/domain/activity-policy";
import { setMockPin } from "./mock-store";
import { createLocalInvitation, listLocalInvitations, type LocalInvitation } from "./local-accounts";

const globalState = globalThis as typeof globalThis & { __hguniSettings?: { pinConfigured: boolean; schedules: ActivityScheduleDto[]; invitations: LocalInvitation[]; reduceTransparency: boolean } };
globalState.__hguniSettings ??= { pinConfigured: true, reduceTransparency: false, invitations: [], schedules: [{ id: "mock-schedule-morning", name: "아침 등교지도", weekdays: [1,2,3,4,5], startLocal: "07:40", endLocal: "08:30", enabled: true, allowedItemKeys: ["D:UNIFORM","D:PROXY","D:LATE"] }] };
const mock = globalState.__hguniSettings;

function readiness(settings: Omit<SettingsDto, "readiness">): SettingsDto["readiness"] {
  return [
    { key: "bridge", label: "학교 PC 연결", ready: settings.bridge.online && settings.bridge.sqlReady, detail: settings.bridge.online ? "유니쿨 중계가 연결되어 있습니다." : "중계 연결이 필요합니다." },
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
  const db = localDb();
  const settings = db.prepare("SELECT * FROM app_settings WHERE id=1").get() as { pin_hash:string|null;settings_version:number;teacher_source_id:string|null;paused:number };
  const scheduleRows = db.prepare("SELECT * FROM activity_schedules ORDER BY start_local").all() as Array<{ id:string;name:string;weekdays_json:string;start_local:string;end_local:string;enabled:number }>;
  const schedules = scheduleRows.map((row) => ({ id:row.id,name:row.name,weekdays:json<number[]>(row.weekdays_json,[]),startLocal:row.start_local,endLocal:row.end_local,enabled:Boolean(row.enabled),allowedItemKeys:(db.prepare("SELECT item_key FROM schedule_items WHERE schedule_id=? ORDER BY item_key").all(row.id) as Array<{item_key:string}>).map((item)=>item.item_key) }));
  const bridge = db.prepare("SELECT last_seen_at,sql_checked_at,capabilities_json FROM bridge_instances WHERE enabled=1 ORDER BY last_seen_at DESC LIMIT 1").get() as {last_seen_at:string|null;sql_checked_at:string|null;capabilities_json:string}|undefined;
  const catalog = db.prepare("SELECT id,synced_at FROM catalog_versions WHERE status='active' ORDER BY synced_at DESC LIMIT 1").get() as {id:string;synced_at:string}|undefined;
  const recent=(value:string|null|undefined)=>Boolean(value&&Date.now()-Date.parse(value)<=30_000);
  const capabilities=json<{penalty?:boolean;cancellation?:boolean}>(bridge?.capabilities_json,{});
  const sourceTeachers = catalog ? (db.prepare("SELECT source_id,name,active FROM source_teachers WHERE catalog_version=? ORDER BY name").all(catalog.id) as Array<{source_id:string;name:string;active:number}>).map((row)=>({id:row.source_id,name:row.name,active:Boolean(row.active)})) : [];
  const penaltyItems = catalog ? (db.prepare("SELECT item_key,label,signed_points,enabled FROM penalty_items WHERE catalog_version=? AND kind='D' ORDER BY code").all(catalog.id) as Array<{item_key:string;label:string;signed_points:number;enabled:number}>).map((row)=>({key:row.item_key,label:row.label,signedPoints:row.signed_points,enabled:Boolean(row.enabled)})) : [];
  const value = { timezone:"Asia/Seoul" as const,settingsVersion:settings.settings_version,teacherSourceId:settings.teacher_source_id,pinConfigured:Boolean(settings.pin_hash),schedules,sourceTeachers,penaltyItems,paused:Boolean(settings.paused),bridge:{online:recent(bridge?.last_seen_at),sqlReady:recent(bridge?.sql_checked_at),catalogSyncedAt:catalog?.synced_at??null,penaltyReady:Boolean(capabilities.penalty),cancellationReady:Boolean(capabilities.cancellation)} };
  return { ...value, readiness: readiness(value) };
}

export async function addSchedule(input: Omit<ActivityScheduleDto, "id">) {
  validateSchedule(input);
  const current = await getSettings();
  if (current.schedules.filter((item) => item.enabled && input.enabled).some((item) => schedulesOverlap(item, input))) throw new Error("SCHEDULE_OVERLAP");
  if (isMockMode()) { const value={...input,id:randomUUID()}; mock.schedules.push(value); return value; }
  const value={...input,id:randomUUID()}; const db=localDb(); const now=new Date().toISOString();
  db.transaction(()=>{db.prepare("INSERT INTO activity_schedules(id,name,weekdays_json,start_local,end_local,enabled,created_at) VALUES (?,?,?,?,?,?,?)").run(value.id,value.name,JSON.stringify(value.weekdays),value.startLocal,value.endLocal,Number(value.enabled),now);const insert=db.prepare("INSERT INTO schedule_items(schedule_id,item_key) VALUES (?,?)");for(const key of value.allowedItemKeys)insert.run(value.id,key);})();
  return value;
}

export async function updateSettings(input:{settingsVersion:number;teacherSourceId?:string|null;paused?:boolean}) {
  if(isMockMode())return {...input,settingsVersion:input.settingsVersion+1};
  const db=localDb();
  if(input.teacherSourceId){const catalog=db.prepare("SELECT id FROM catalog_versions WHERE status='active' ORDER BY synced_at DESC LIMIT 1").get() as {id:string}|undefined;const source=catalog&&db.prepare("SELECT 1 FROM source_teachers WHERE catalog_version=? AND source_id=? AND active=1").get(catalog.id,input.teacherSourceId);if(!source)throw new Error("TEACHER_SOURCE_INVALID");}
  if(input.paused===false){const current=await getSettings();if(current.readiness.some((item)=>!item.ready&&item.key!=="teacher")||(!input.teacherSourceId&&!current.teacherSourceId))throw new Error("NOT_READY");}
  const current=db.prepare("SELECT settings_version FROM app_settings WHERE id=1").get() as {settings_version:number};if(current.settings_version!==input.settingsVersion)throw new Error("SETTINGS_CONFLICT");
  const result=db.prepare(`UPDATE app_settings SET teacher_source_id=COALESCE(?,teacher_source_id),paused=COALESCE(?,paused),settings_version=settings_version+1,updated_at=? WHERE id=1 AND settings_version=?`).run(input.teacherSourceId===undefined?null:input.teacherSourceId,input.paused===undefined?null:Number(input.paused),new Date().toISOString(),input.settingsVersion);if(!result.changes)throw new Error("SETTINGS_CONFLICT");
  return {...input,settingsVersion:input.settingsVersion+1};
}

export async function changePin(pin:string,actorId:string){if(isMockMode()){mock.pinConfigured=true;setMockPin(pin);return;}const config=env();if(!config.PIN_PEPPER)throw new Error("PIN_PEPPER가 설정되지 않았습니다.");const pinHash=await argon2.hash(`${pin}:${config.PIN_PEPPER}`);const db=localDb();db.transaction(()=>{db.prepare("UPDATE app_settings SET pin_hash=?,pin_version=pin_version+1,settings_version=settings_version+1,updated_at=? WHERE id=1").run(pinHash,new Date().toISOString());db.prepare("UPDATE council_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE revoked_at IS NULL").run(new Date().toISOString());audit("teacher","pin.changed",actorId);})();}

export async function listInvitations(){return isMockMode()?[...mock.invitations]:listLocalInvitations();}
export async function inviteTeacher(email:string,role:"admin"|"teacher",invitedBy:string){if(isMockMode()){const value={id:randomUUID(),email:email.trim().toLowerCase(),role,status:"pending",issuedAt:new Date().toISOString(),inviteUrl:`${env().APP_BASE_URL}/teacher/accept-invite?token=mock-local-invitation-token-123456`};mock.invitations.unshift(value);return value;}return createLocalInvitation(email,role,invitedBy);}
