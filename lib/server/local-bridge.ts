import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Catalog, BridgeJob, BridgeOutcome } from "@/bridge/types";
import type { RequestState } from "@/lib/domain/contracts";
import { audit, enqueueGoogleSync, json, localDb } from "./local-db";
import { env, isMockMode } from "./env";

type BridgeRow = { id: string; scope: string; enabled: number };
type JobRow = {
  id: string;
  operation: "penalty" | "cancel";
  request_id: string;
  penalty_request_id: string;
  state: string;
  execute_before: string;
  lease_owner: string | null;
  lease_generation: number;
  lease_until: string | null;
};
type PenaltyJobRow = {
  id: string;
  request_id: string;
  snapshot_json: string;
  payload_hash: string;
  source_record_id: string | null;
  state: string;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const nowIso = () => new Date().toISOString();

export function findBridge(token: string, scope: string) {
  if (isMockMode()) {
    return token === (process.env.MOCK_BRIDGE_TOKEN ?? "mock-bridge-token-for-development") && scope === env().SOURCE_SCOPE
      ? { id: "00000000-0000-4000-8000-000000000001", scope, enabled: 1 }
      : null;
  }
  const row = localDb().prepare("SELECT id,scope,enabled FROM bridge_instances WHERE token_hash=?").get(sha256(token)) as BridgeRow | undefined;
  return row?.enabled && row.scope === scope && row.scope === env().SOURCE_SCOPE ? row : null;
}

export function createBridgeToken(label: string, actorId: string) {
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  localDb().prepare(`INSERT INTO bridge_instances(id,label,token_hash,scope,enabled,created_at) VALUES (?,?,?,?,1,?)`).run(id, label, sha256(token), env().SOURCE_SCOPE, nowIso());
  audit("teacher", "bridge.token_created", actorId, id, { label });
  return { token, bridgeId: id };
}

export function heartbeatBridge(bridgeId: string, input: { sqlReady: boolean; penalty: boolean; cancellation: boolean; version: string }) {
  const now = nowIso();
  localDb().prepare(`
    UPDATE bridge_instances SET last_seen_at=?,sql_checked_at=?,capabilities_json=?,version=? WHERE id=?
  `).run(now, input.sqlReady ? now : null, JSON.stringify({ penalty: input.penalty, cancellation: input.cancellation }), input.version, bridgeId);
}

export function publishCatalog(scope: string, catalog: Catalog, checksum: string) {
  const db = localDb();
  const id = randomUUID();
  const created = nowIso();
  db.transaction(() => {
    db.prepare(`INSERT INTO catalog_versions(id,source_scope,status,checksum,counts_json,created_at) VALUES (?,?,?,?,?,?)`).run(id, scope, "uploading", checksum, JSON.stringify({ students: catalog.students.length, items: catalog.items.length, teachers: catalog.teachers.length }), created);
    const insertStudent = db.prepare(`INSERT INTO students(catalog_version,source_id,name,grade,class_label,number,source_class,active) VALUES (?,?,?,?,?,?,?,?)`);
    for (const value of catalog.students) insertStudent.run(id, value.id, value.name, value.grade, value.classLabel, value.number, value.sourceClass, Number(value.active));
    const insertItem = db.prepare(`INSERT INTO penalty_items(catalog_version,item_key,kind,code,label,signed_points,enabled) VALUES (?,?,?,?,?,?,?)`);
    for (const value of catalog.items) insertItem.run(id, value.key, value.kind, value.code, value.label, value.signedPoints, Number(value.enabled));
    const insertTeacher = db.prepare(`INSERT INTO source_teachers(catalog_version,source_id,name,active) VALUES (?,?,?,?)`);
    for (const value of catalog.teachers) insertTeacher.run(id, value.id, value.name, Number(value.active));
    db.prepare("UPDATE catalog_versions SET status='superseded' WHERE source_scope=? AND status='active'").run(scope);
    db.prepare("UPDATE catalog_versions SET status='active',synced_at=? WHERE id=?").run(nowIso(), id);
    audit("bridge", "catalog.activated", null, id, { students: catalog.students.length, items: catalog.items.length, teachers: catalog.teachers.length });
    const old = db.prepare("SELECT id FROM catalog_versions WHERE status='superseded' ORDER BY synced_at DESC LIMIT -1 OFFSET 2").all() as Array<{ id: string }>;
    const remove = db.prepare("DELETE FROM catalog_versions WHERE id=?");
    for (const row of old) remove.run(row.id);
  })();
  return id;
}

function jobPayload(job: JobRow, penalty: PenaltyJobRow): BridgeJob {
  const payload = json<BridgeJob["payload"]>(penalty.snapshot_json, {} as never);
  return {
    jobId: job.id,
    operation: job.operation,
    requestId: job.request_id,
    leaseGeneration: job.lease_generation,
    leaseUntil: job.lease_until!,
    executeBefore: job.execute_before,
    payloadHash: job.operation === "penalty" ? penalty.payload_hash : sha256(`${job.request_id}:${penalty.payload_hash}`),
    sourceRecordId: penalty.source_record_id,
    payload,
  };
}

export function claimBridgeJob(bridgeId: string, leaseSeconds = 20): BridgeJob | null {
  const db = localDb();
  return db.transaction(() => {
    const now = nowIso();
    const expired = db.prepare("SELECT operation,penalty_request_id FROM bridge_jobs WHERE state IN ('queued','leased') AND execute_before<=?").all(now) as Array<{ operation:"penalty"|"cancel";penalty_request_id:string }>;
    db.prepare("UPDATE bridge_jobs SET state='blocked',updated_at=? WHERE state IN ('queued','leased') AND execute_before<=?").run(now, now);
    const expirePenalty = db.prepare("UPDATE penalty_requests SET state=?,updated_at=? WHERE id=? AND state NOT IN ('succeeded','cancel_succeeded')");
    for (const row of expired) expirePenalty.run(row.operation === "penalty" ? "expired_unsent" : "cancel_manual_required", now, row.penalty_request_id);
    const row = db.prepare(`
      SELECT * FROM bridge_jobs
      WHERE execute_before>? AND (state='queued' OR (state='leased' AND lease_until<=?))
        AND (operation='penalty' OR EXISTS (SELECT 1 FROM penalty_requests p WHERE p.id=bridge_jobs.penalty_request_id AND p.source_record_id IS NOT NULL))
      ORDER BY created_at LIMIT 1
    `).get(now, now) as JobRow | undefined;
    if (!row) return null;
    const leaseUntil = new Date(Date.now() + Math.min(Math.max(leaseSeconds, 5), 60) * 1000).toISOString();
    db.prepare(`UPDATE bridge_jobs SET state='leased',lease_owner=?,lease_generation=lease_generation+1,lease_until=?,attempt_count=attempt_count+1,updated_at=? WHERE id=?`).run(bridgeId, leaseUntil, now, row.id);
    const leased = db.prepare("SELECT * FROM bridge_jobs WHERE id=?").get(row.id) as JobRow;
    const penalty = db.prepare("SELECT * FROM penalty_requests WHERE id=?").get(row.penalty_request_id) as PenaltyJobRow;
    return jobPayload(leased, penalty);
  })();
}

export function authorizeBridgeJob(jobId: string, bridgeId: string, generation: number) {
  const db = localDb();
  return db.transaction(() => {
    const row = db.prepare("SELECT * FROM bridge_jobs WHERE id=?").get(jobId) as JobRow | undefined;
    if (!row || row.state !== "leased" || row.lease_owner !== bridgeId || row.lease_generation !== generation || !row.lease_until || Date.parse(row.lease_until) <= Date.now() || Date.parse(row.execute_before) <= Date.now()) return false;
    db.prepare("UPDATE bridge_jobs SET state='authorized',updated_at=? WHERE id=?").run(nowIso(), jobId);
    db.prepare(`UPDATE penalty_requests SET state=CASE WHEN state IN ('cancel_requested','cancel_approved') THEN state ELSE ? END,updated_at=? WHERE id=?`).run(row.operation === "penalty" ? "executing" : "cancel_approved", nowIso(), row.penalty_request_id);
    return true;
  })();
}

function outcomeState(operation: JobRow["operation"], outcome: BridgeOutcome["outcome"]): RequestState {
  if (outcome === "succeeded") return operation === "penalty" ? "succeeded" : "cancel_succeeded";
  if (outcome === "failed_safe") return "failed_safe";
  if (outcome === "manual_required") return "cancel_manual_required";
  return "uncertain";
}

function finishJob(job: JobRow, outcome: BridgeOutcome, reconcile: boolean) {
  const db = localDb();
  const state = outcomeState(job.operation, outcome.outcome);
  const now = nowIso();
  db.prepare("UPDATE bridge_jobs SET state=?,result_json=?,updated_at=? WHERE id=?").run(state === "uncertain" ? "uncertain" : "reported", JSON.stringify(outcome.result), now, job.id);
  const sourceRecordId = typeof outcome.result.sourceRecordId === "string" ? outcome.result.sourceRecordId : null;
  db.prepare(`
    UPDATE penalty_requests SET state=CASE WHEN ?='penalty' AND state IN ('cancel_requested','cancel_approved') THEN state ELSE ? END,source_record_id=COALESCE(?,source_record_id),result_json=?,updated_at=?
    WHERE id=? AND state NOT IN ('succeeded','cancel_succeeded')
  `).run(job.operation, state, sourceRecordId, JSON.stringify(outcome.result), now, job.penalty_request_id);
  const penalty = db.prepare("SELECT * FROM penalty_requests WHERE id=?").get(job.penalty_request_id) as PenaltyJobRow & { snapshot_json: string; created_at?: string };
  enqueueGoogleSync("penalty.updated", { requestId: penalty.request_id, state: penalty.state, ...json<Record<string, unknown>>(penalty.snapshot_json, {}), result: outcome.result });
  audit("bridge", reconcile ? "job.reconciled" : "job.reported", job.lease_owner, job.request_id, { operation: job.operation, outcome: outcome.outcome });
}

export function reportBridgeJob(jobId: string, bridgeId: string, generation: number, outcome: BridgeOutcome) {
  const db = localDb();
  db.transaction(() => {
    const row = db.prepare("SELECT * FROM bridge_jobs WHERE id=?").get(jobId) as JobRow | undefined;
    if (!row || row.lease_owner !== bridgeId || row.lease_generation !== generation) throw new Error("STALE_LEASE");
    if (row.state === "reported") return;
    finishJob(row, outcome, false);
  })();
}

export function reconcileBridgeJob(jobId: string, bridgeId: string, outcome: BridgeOutcome) {
  const db = localDb();
  db.transaction(() => {
    const row = db.prepare("SELECT * FROM bridge_jobs WHERE id=?").get(jobId) as JobRow | undefined;
    if (!row) throw new Error("JOB_NOT_FOUND");
    const identified = { ...row, lease_owner: bridgeId };
    if (outcome.outcome === "succeeded") finishJob(identified, outcome, true);
    else {
      db.prepare("UPDATE bridge_jobs SET state='uncertain',result_json=?,updated_at=? WHERE id=?").run(JSON.stringify(outcome.result), nowIso(), jobId);
      db.prepare("UPDATE penalty_requests SET state=CASE WHEN state IN ('cancel_requested','cancel_approved') THEN state ELSE 'uncertain' END,result_json=?,updated_at=? WHERE id=? AND state NOT IN ('succeeded','cancel_succeeded')").run(JSON.stringify(outcome.result), nowIso(), row.penalty_request_id);
    }
  })();
}
