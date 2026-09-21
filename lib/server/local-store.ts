import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import type { CouncilStatus, PenaltyItem, PenaltyRecord, RequestState, Student } from "@/lib/domain/contracts";
import { isOpenAt, koreaParts } from "@/lib/domain/activity-policy";
import type { AppStore, PenaltyInput } from "./store";
import { audit, enqueueGoogleSync, json, localDb } from "./local-db";
import { env } from "./env";

type SettingsRow = {
  pin_hash: string | null;
  pin_version: number;
  teacher_source_id: string | null;
  paused: number;
};
type ScheduleRow = {
  id: string;
  name: string;
  weekdays_json: string;
  start_local: string;
  end_local: string;
  enabled: number;
};
type SessionRow = {
  id: string;
  occurrence_key: string;
  schedule_id: string;
  pin_version: number;
  roster_json: string;
  expires_at: string;
  revoked_at: string | null;
};
type PenaltyRow = {
  id: string;
  request_id: string;
  session_id: string;
  snapshot_json: string;
  payload_hash: string;
  state: RequestState;
  source_record_id: string | null;
  result_json: string;
  cancellation_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const nowIso = () => new Date().toISOString();

function settings() {
  return localDb().prepare("SELECT pin_hash, pin_version, teacher_source_id, paused FROM app_settings WHERE id=1").get() as SettingsRow;
}

function schedules() {
  return (localDb().prepare("SELECT * FROM activity_schedules WHERE enabled=1 ORDER BY start_local").all() as ScheduleRow[]).map((row) => ({
    row,
    schedule: { name: row.name, weekdays: json<number[]>(row.weekdays_json, []), startLocal: row.start_local, endLocal: row.end_local },
  }));
}

function activeSchedule(date = new Date()) {
  return schedules().find(({ schedule }) => isOpenAt(schedule, date)) ?? null;
}

function occurrence(scheduleId: string, date = new Date()) {
  return `${koreaParts(date).date}:${scheduleId}`;
}

function bridgeReady() {
  const row = localDb().prepare(`
    SELECT last_seen_at, sql_checked_at, capabilities_json
    FROM bridge_instances WHERE enabled=1 AND scope=? ORDER BY last_seen_at DESC LIMIT 1
  `).get(env().SOURCE_SCOPE) as { last_seen_at: string | null; sql_checked_at: string | null; capabilities_json: string } | undefined;
  const recent = (value: string | null) => Boolean(value && Date.now() - Date.parse(value) <= 30_000);
  return Boolean(row && recent(row.last_seen_at) && recent(row.sql_checked_at) && json<{ penalty?: boolean }>(row.capabilities_json, {}).penalty);
}

function activeCatalog() {
  return localDb().prepare("SELECT id, synced_at FROM catalog_versions WHERE status='active' ORDER BY synced_at DESC LIMIT 1").get() as { id: string; synced_at: string } | undefined;
}

function lockReason(date = new Date()): CouncilStatus["lockReason"] {
  const appSettings = settings();
  if (!activeSchedule(date)) return "outside_hours";
  if (appSettings.paused || !bridgeReady()) return "bridge_offline";
  if (!appSettings.teacher_source_id) return "teacher_missing";
  const catalog = activeCatalog();
  if (!catalog || Date.now() - Date.parse(catalog.synced_at) > 24 * 60 * 60_000) return "catalog_missing";
  return null;
}

function requireSession(token: string) {
  const appSettings = settings();
  const row = localDb().prepare("SELECT * FROM council_sessions WHERE token_hash=?").get(sha256(token)) as SessionRow | undefined;
  const schedule = activeSchedule();
  if (
    !row || row.revoked_at || Date.parse(row.expires_at) <= Date.now() || row.pin_version !== appSettings.pin_version ||
    appSettings.paused || !schedule || schedule.row.id !== row.schedule_id || lockReason() !== null
  ) throw new Error("SESSION_INVALID");
  return row;
}

function toRecord(row: PenaltyRow): PenaltyRecord {
  const snapshot = json<{ student: Student; item: PenaltyItem; roster: string[] }>(row.snapshot_json, {} as never);
  const result = json<{ message?: string }>(row.result_json, {});
  return {
    id: row.id,
    requestId: row.request_id,
    student: snapshot.student,
    item: snapshot.item,
    roster: snapshot.roster,
    state: row.state,
    createdAt: row.created_at,
    ...(row.cancellation_reason || result.message ? { message: row.cancellation_reason ?? result.message } : {}),
    ...(row.cancellation_id ? { cancellationId: row.cancellation_id } : {}),
  };
}

function penaltyRow(requestId: string) {
  return localDb().prepare("SELECT * FROM penalty_requests WHERE request_id=?").get(requestId) as PenaltyRow | undefined;
}

function sessionPenalty(token: string, requestId: string) {
  const session = requireSession(token);
  const row = penaltyRow(requestId);
  if (!row || row.session_id !== session.id) throw new Error("NOT_FOUND");
  return row;
}

export const localStore: AppStore = {
  async status(token) {
    const current = activeSchedule();
    const reason = lockReason();
    let session: SessionRow | undefined;
    if (token) session = localDb().prepare("SELECT * FROM council_sessions WHERE token_hash=?").get(sha256(token)) as SessionRow | undefined;
    const unlocked = Boolean(session && !session.revoked_at && Date.parse(session.expires_at) > Date.now() && reason === null && session.pin_version === settings().pin_version);
    return {
      mode: "live",
      activity: current ? { id: occurrence(current.row.id), name: current.row.name, startsAt: current.row.start_local, endsAt: current.row.end_local } : null,
      lockReason: reason,
      session: { unlocked, roster: unlocked && session ? json<string[]>(session.roster_json, []) : [] },
      bridgeReady: bridgeReady(),
    };
  },

  async unlock(pin, clientKey) {
    const config = env();
    if (!config.PIN_PEPPER) throw new Error("PIN_NOT_CONFIGURED");
    const current = activeSchedule();
    if (!current || lockReason() !== null) throw new Error("SESSION_INVALID");
    const bucket = sha256(`${clientKey}:${config.PIN_PEPPER}`);
    const db = localDb();
    const attempt = db.prepare("SELECT failures, window_started_at, blocked_until FROM pin_attempts WHERE bucket_hash=?").get(bucket) as { failures: number; window_started_at: string; blocked_until: string | null } | undefined;
    if (attempt?.blocked_until && Date.parse(attempt.blocked_until) > Date.now()) throw new Error("PIN_RATE_LIMITED");
    const appSettings = settings();
    if (!appSettings.pin_hash) throw new Error("PIN_NOT_CONFIGURED");
    if (!(await argon2.verify(appSettings.pin_hash, `${pin}:${config.PIN_PEPPER}`))) {
      const resetWindow = !attempt || Date.now() - Date.parse(attempt.window_started_at) >= 5 * 60_000;
      const failures = resetWindow ? 1 : attempt.failures + 1;
      const blockedUntil = failures >= 5 ? new Date(Date.now() + 5 * 60_000).toISOString() : null;
      db.prepare(`
        INSERT INTO pin_attempts(bucket_hash, window_started_at, failures, blocked_until) VALUES (?, ?, ?, ?)
        ON CONFLICT(bucket_hash) DO UPDATE SET window_started_at=excluded.window_started_at, failures=excluded.failures, blocked_until=excluded.blocked_until
      `).run(bucket, resetWindow ? nowIso() : attempt.window_started_at, failures, blockedUntil);
      throw new Error(blockedUntil ? "PIN_RATE_LIMITED" : "PIN_INVALID");
    }
    db.prepare("DELETE FROM pin_attempts WHERE bucket_hash=?").run(bucket);
    const token = randomBytes(32).toString("base64url");
    const end = new Date(`${koreaParts(new Date()).date}T${current.row.end_local}:00+09:00`).toISOString();
    const id = randomUUID();
    db.prepare(`
      INSERT INTO council_sessions(id, token_hash, occurrence_key, schedule_id, pin_version, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, sha256(token), occurrence(current.row.id), current.row.id, appSettings.pin_version, end, nowIso());
    audit("council", "session.opened", id, occurrence(current.row.id));
    return { token, expiresAt: end };
  },

  async setRoster(token, names) {
    const session = requireSession(token);
    const normalized = names.map((name) => name.trim());
    if (normalized.length < 1 || normalized.length > 10 || normalized.some((name) => name.length < 1 || name.length > 30) || new Set(normalized).size !== normalized.length) throw new Error("INVALID_ROSTER");
    localDb().prepare("UPDATE council_sessions SET roster_json=? WHERE id=?").run(JSON.stringify(normalized), session.id);
    audit("council", "roster.updated", session.id, session.occurrence_key, { count: normalized.length });
    return normalized;
  },

  async students(token, query) {
    requireSession(token);
    const normalized = query.trim();
    if (normalized.length < 2) return [];
    const catalog = activeCatalog();
    if (!catalog) return [];
    const pattern = `%${normalized.replace(/[\\%_]/g, "\\$&")}%`;
    const rows = localDb().prepare(`
      SELECT source_id, name, grade, class_label, number, source_class, active
      FROM students WHERE catalog_version=? AND active=1 AND (name LIKE ? ESCAPE '\\' OR source_id LIKE ? ESCAPE '\\')
      ORDER BY name, grade, class_label, number LIMIT 20
    `).all(catalog.id, pattern, pattern) as Array<{ source_id: string; name: string; grade: number; class_label: string; number: number; source_class: string; active: number }>;
    return rows.map((row) => ({ id: row.source_id, name: row.name, grade: row.grade, classLabel: row.class_label, number: row.number, sourceClass: row.source_class, active: Boolean(row.active) }));
  },

  async items(token) {
    const session = requireSession(token);
    const catalog = activeCatalog();
    if (!catalog) throw new Error("CATALOG_STALE");
    const rows = localDb().prepare(`
      SELECT p.item_key, p.kind, p.code, p.label, p.signed_points, p.enabled
      FROM penalty_items p JOIN schedule_items s ON s.item_key=p.item_key
      WHERE p.catalog_version=? AND s.schedule_id=? AND p.enabled=1 ORDER BY p.code
    `).all(catalog.id, session.schedule_id) as Array<{ item_key: string; kind: "D"; code: string; label: string; signed_points: number; enabled: number }>;
    return { version: catalog.id, items: rows.map((row) => ({ key: row.item_key, kind: row.kind, code: row.code, label: row.label, signedPoints: row.signed_points, enabled: Boolean(row.enabled) })) };
  },

  async createPenalty(token, input: PenaltyInput) {
    const session = requireSession(token);
    const db = localDb();
    const existing = penaltyRow(input.requestId);
    if (existing) {
      const expectedHash = sha256(JSON.stringify({ student: input.studentId, item: input.itemKey, catalog: input.catalogVersion, occurrence: session.occurrence_key }));
      if (existing.session_id !== session.id || existing.payload_hash !== expectedHash) throw new Error("REQUEST_ID_CONFLICT");
      return toRecord(existing);
    }
    const roster = json<string[]>(session.roster_json, []);
    if (!roster.length) throw new Error("ROSTER_REQUIRED");
    const catalog = activeCatalog();
    if (!catalog || input.catalogVersion !== catalog.id) throw new Error("CATALOG_STALE");
    const student = db.prepare(`SELECT source_id,name,grade,class_label,number,source_class,active FROM students WHERE catalog_version=? AND source_id=? AND active=1`).get(catalog.id, input.studentId) as { source_id: string; name: string; grade: number; class_label: string; number: number; source_class: string; active: number } | undefined;
    const item = db.prepare(`SELECT item_key,kind,code,label,signed_points,enabled FROM penalty_items WHERE catalog_version=? AND item_key=? AND enabled=1`).get(catalog.id, input.itemKey) as { item_key: string; kind: "D"; code: string; label: string; signed_points: number; enabled: number } | undefined;
    const allowed = db.prepare("SELECT 1 FROM schedule_items WHERE schedule_id=? AND item_key=?").get(session.schedule_id, input.itemKey);
    if (!student || !item || !allowed) throw new Error("CATALOG_STALE");
    const appSettings = settings();
    if (!appSettings.teacher_source_id) throw new Error("SESSION_INVALID");
    const studentValue: Student = { id: student.source_id, name: student.name, grade: student.grade, classLabel: student.class_label, number: student.number, sourceClass: student.source_class, active: Boolean(student.active) };
    const itemValue: PenaltyItem = { key: item.item_key, kind: item.kind, code: item.code, label: item.label, signedPoints: item.signed_points, enabled: Boolean(item.enabled) };
    const snapshot = { student: studentValue, item: itemValue, roster, teacherSourceId: appSettings.teacher_source_id, sourceScope: env().SOURCE_SCOPE };
    const payloadHash = sha256(JSON.stringify({ student: input.studentId, item: input.itemKey, catalog: catalog.id, occurrence: session.occurrence_key }));
    const createdAt = nowIso();
    const executeBefore = new Date(Math.min(Date.now() + 30_000, Date.parse(session.expires_at))).toISOString();
    const id = randomUUID();
    const insert = db.transaction(() => {
      db.prepare(`
        INSERT INTO penalty_requests(id,request_id,session_id,occurrence_key,student_id,item_key,snapshot_json,payload_hash,state,execute_before,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).run(id, input.requestId, session.id, session.occurrence_key, input.studentId, input.itemKey, JSON.stringify(snapshot), payloadHash, "queued", executeBefore, createdAt, createdAt);
      db.prepare(`
        INSERT INTO bridge_jobs(id,operation,request_id,penalty_request_id,state,execute_before,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(randomUUID(), "penalty", input.requestId, id, "queued", executeBefore, createdAt, createdAt);
      audit("council", "penalty.accepted", session.id, input.requestId);
    });
    try { insert(); } catch (error) {
      const afterConflict = penaltyRow(input.requestId);
      if (afterConflict) return toRecord(afterConflict);
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) throw new Error("DUPLICATE_PENALTY");
      throw error;
    }
    return toRecord(penaltyRow(input.requestId)!);
  },

  async penalty(token, requestId) { return toRecord(sessionPenalty(token, requestId)); },

  async history(token) {
    const session = requireSession(token);
    return (localDb().prepare("SELECT * FROM penalty_requests WHERE session_id=? ORDER BY created_at DESC LIMIT 100").all(session.id) as PenaltyRow[]).map(toRecord);
  },

  async requestCancellation(token, requestId, reason) {
    const row = sessionPenalty(token, requestId);
    if (!reason.trim() || !["queued", "executing", "succeeded", "uncertain"].includes(row.state)) throw new Error("CANCELLATION_INVALID");
    const cancellationId = randomUUID();
    localDb().prepare(`UPDATE penalty_requests SET state='cancel_requested', cancellation_id=?, cancellation_reason=?, updated_at=? WHERE id=?`).run(cancellationId, reason.trim(), nowIso(), row.id);
    audit("council", "cancellation.requested", row.session_id, requestId);
    return toRecord(penaltyRow(requestId)!);
  },

  async end(token) {
    const session = requireSession(token);
    localDb().prepare("UPDATE council_sessions SET revoked_at=? WHERE id=? AND revoked_at IS NULL").run(nowIso(), session.id);
  },

  async teacherHistory() {
    return (localDb().prepare("SELECT * FROM penalty_requests ORDER BY created_at DESC LIMIT 250").all() as PenaltyRow[]).map(toRecord);
  },

  async approveCancellation(requestId, reason, actorId) {
    const row = penaltyRow(requestId);
    if (!row || row.state !== "cancel_requested" || !row.cancellation_id) throw new Error("CANCELLATION_INVALID");
    const db = localDb();
    db.transaction(() => {
      const message = reason.trim() || row.cancellation_reason || "교사 승인";
      const queued = db.prepare("SELECT id FROM bridge_jobs WHERE penalty_request_id=? AND operation='penalty' AND state='queued'").get(row.id) as { id: string } | undefined;
      if (queued) {
        db.prepare("UPDATE bridge_jobs SET state='blocked',updated_at=? WHERE id=?").run(nowIso(), queued.id);
        db.prepare("UPDATE penalty_requests SET state='cancel_succeeded',cancellation_reason=?,updated_at=? WHERE id=?").run(message, nowIso(), row.id);
      } else {
        db.prepare("UPDATE penalty_requests SET state='cancel_approved',cancellation_reason=?,updated_at=? WHERE id=?").run(message, nowIso(), row.id);
        db.prepare(`INSERT OR IGNORE INTO bridge_jobs(id,operation,request_id,penalty_request_id,state,execute_before,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`).run(randomUUID(), "cancel", row.cancellation_id, row.id, "queued", new Date(Date.now() + 24 * 60 * 60_000).toISOString(), nowIso(), nowIso());
      }
      audit("teacher", "cancellation.approved", actorId, requestId);
    })();
    const updated = toRecord(penaltyRow(requestId)!);
    enqueueGoogleSync("penalty.updated", updated);
    return updated;
  },

  async rejectCancellation(requestId, reason, actorId) {
    const row = penaltyRow(requestId);
    if (!row || row.state !== "cancel_requested") throw new Error("CANCELLATION_INVALID");
    localDb().prepare("UPDATE penalty_requests SET state=?,cancellation_reason=?,updated_at=? WHERE id=?").run(row.source_record_id ? "succeeded" : "queued", reason.trim(), nowIso(), row.id);
    audit("teacher", "cancellation.rejected", actorId, requestId);
    return toRecord(penaltyRow(requestId)!);
  },
};
