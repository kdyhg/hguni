import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { env } from "./env";

const SCHEMA_VERSION = 1;

const schema = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  timezone TEXT NOT NULL DEFAULT 'Asia/Seoul',
  pin_hash TEXT,
  pin_version INTEGER NOT NULL DEFAULT 1,
  settings_version INTEGER NOT NULL DEFAULT 1,
  teacher_source_id TEXT,
  paused INTEGER NOT NULL DEFAULT 1 CHECK (paused IN (0, 1)),
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS activity_schedules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  weekdays_json TEXT NOT NULL,
  start_local TEXT NOT NULL,
  end_local TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS schedule_items (
  schedule_id TEXT NOT NULL REFERENCES activity_schedules(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  PRIMARY KEY (schedule_id, item_key)
) STRICT;

CREATE TABLE IF NOT EXISTS teacher_accounts (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS teacher_sessions (
  token_hash TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL REFERENCES teacher_accounts(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS teacher_sessions_expiry ON teacher_sessions(expires_at);

CREATE TABLE IF NOT EXISTS teacher_invitations (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by TEXT NOT NULL REFERENCES teacher_accounts(id),
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS teacher_invitations_email ON teacher_invitations(email, issued_at DESC);

CREATE TABLE IF NOT EXISTS bridge_instances (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  last_seen_at TEXT,
  sql_checked_at TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  version TEXT,
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS catalog_versions (
  id TEXT PRIMARY KEY,
  source_scope TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('uploading', 'active', 'superseded', 'failed')),
  checksum TEXT NOT NULL,
  counts_json TEXT NOT NULL,
  synced_at TEXT,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS catalog_active ON catalog_versions(status, synced_at DESC);

CREATE TABLE IF NOT EXISTS students (
  catalog_version TEXT NOT NULL REFERENCES catalog_versions(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  class_label TEXT NOT NULL,
  number INTEGER NOT NULL,
  source_class TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  PRIMARY KEY (catalog_version, source_id)
) STRICT;
CREATE INDEX IF NOT EXISTS students_search ON students(catalog_version, name, source_id);

CREATE TABLE IF NOT EXISTS penalty_items (
  catalog_version TEXT NOT NULL REFERENCES catalog_versions(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind = 'D'),
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  signed_points REAL NOT NULL,
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  PRIMARY KEY (catalog_version, item_key)
) STRICT;

CREATE TABLE IF NOT EXISTS source_teachers (
  catalog_version TEXT NOT NULL REFERENCES catalog_versions(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active INTEGER NOT NULL CHECK (active IN (0, 1)),
  PRIMARY KEY (catalog_version, source_id)
) STRICT;

CREATE TABLE IF NOT EXISTS pin_attempts (
  bucket_hash TEXT PRIMARY KEY,
  window_started_at TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS council_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  occurrence_key TEXT NOT NULL,
  schedule_id TEXT NOT NULL REFERENCES activity_schedules(id),
  pin_version INTEGER NOT NULL,
  roster_json TEXT NOT NULL DEFAULT '[]',
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS council_sessions_token ON council_sessions(token_hash);

CREATE TABLE IF NOT EXISTS penalty_requests (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  session_id TEXT NOT NULL REFERENCES council_sessions(id),
  occurrence_key TEXT NOT NULL,
  student_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  state TEXT NOT NULL,
  execute_before TEXT NOT NULL,
  source_record_id TEXT,
  result_json TEXT NOT NULL DEFAULT '{}',
  cancellation_id TEXT,
  cancellation_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE UNIQUE INDEX IF NOT EXISTS penalty_business_unique
  ON penalty_requests(occurrence_key, student_id, item_key)
  WHERE state <> 'cancel_succeeded';
CREATE INDEX IF NOT EXISTS penalty_requests_session ON penalty_requests(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS bridge_jobs (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('penalty', 'cancel')),
  request_id TEXT NOT NULL UNIQUE,
  penalty_request_id TEXT NOT NULL REFERENCES penalty_requests(id),
  state TEXT NOT NULL CHECK (state IN ('queued', 'leased', 'authorized', 'reported', 'uncertain', 'blocked')),
  execute_before TEXT NOT NULL,
  lease_owner TEXT,
  lease_generation INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  result_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS bridge_jobs_claim ON bridge_jobs(state, execute_before, created_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_id TEXT,
  redacted_detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS google_sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'synced', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  synced_at TEXT
) STRICT;
CREATE INDEX IF NOT EXISTS google_sync_pending ON google_sync_outbox(state, id);
`;

type LocalGlobal = typeof globalThis & { __hguniLocalDb?: Database.Database };
const localGlobal = globalThis as LocalGlobal;

export function databasePath() {
  return path.resolve(env().LOCAL_DATABASE_PATH);
}

function migrate(db: Database.Database) {
  db.exec(schema);
  const now = new Date().toISOString();
  db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)").run(SCHEMA_VERSION, now);
  db.prepare(`INSERT OR IGNORE INTO app_settings(id, updated_at) VALUES (1, ?)`).run(now);
}

export function localDb() {
  if (localGlobal.__hguniLocalDb) return localGlobal.__hguniLocalDb;
  const location = databasePath();
  fs.mkdirSync(path.dirname(location), { recursive: true });
  const db = new Database(location, { timeout: 5_000 });
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  migrate(db);
  localGlobal.__hguniLocalDb = db;
  return db;
}

export function json<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

export function audit(actorType: string, action: string, actorId?: string | null, targetId?: string | null, detail: unknown = {}) {
  localDb().prepare(`
    INSERT INTO audit_events(actor_type, actor_id, action, target_id, redacted_detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(actorType, actorId ?? null, action, targetId ?? null, JSON.stringify(detail), new Date().toISOString());
}

export function enqueueGoogleSync(eventType: string, payload: unknown) {
  localDb().prepare(`
    INSERT INTO google_sync_outbox(event_type, payload_json, created_at)
    VALUES (?, ?, ?)
  `).run(eventType, JSON.stringify(payload), new Date().toISOString());
}

export function closeLocalDbForTests() {
  if (!localGlobal.__hguniLocalDb) return;
  localGlobal.__hguniLocalDb.close();
  delete localGlobal.__hguniLocalDb;
}
