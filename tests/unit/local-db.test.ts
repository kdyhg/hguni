import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import argon2 from "argon2";
import { randomUUID } from "node:crypto";
import { bootstrapLocalAdmin } from "@/lib/server/local-accounts";
import { authorizeBridgeJob, claimBridgeJob, createBridgeToken, findBridge, heartbeatBridge, publishCatalog, reportBridgeJob } from "@/lib/server/local-bridge";
import { closeLocalDbForTests, localDb } from "@/lib/server/local-db";
import { localStore } from "@/lib/server/local-store";

let tempDir = "";

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "hguni-sqlite-"));
  process.env.APP_ENV = "production";
  process.env.USE_MOCK_DATA = "false";
  process.env.LOCAL_DATABASE_PATH = path.join(tempDir, "hguni.db");
  process.env.PIN_PEPPER = "test-pin-pepper-with-more-than-32-characters";
  process.env.SOURCE_SCOPE = "hguni-test-school";
  process.env.REAL_WRITES_ENABLED = "false";
  process.env.GOOGLE_SHEETS_ENABLED = "false";
});

afterEach(() => {
  closeLocalDbForTests();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("local SQLite storage", () => {
  it("creates the schema and a local administrator", async () => {
    await bootstrapLocalAdmin("admin@school.local", "correct-horse-battery");
    const row = localDb().prepare("SELECT email,role,enabled FROM teacher_accounts").get() as {email:string;role:string;enabled:number};
    expect(row).toEqual({ email: "admin@school.local", role: "admin", enabled: 1 });
    expect(localDb().pragma("quick_check", { simple: true })).toBe("ok");
  });

  it("stores bridge secrets only as hashes", () => {
    const created = createBridgeToken("test bridge", "test-admin");
    expect(findBridge(created.token, "hguni-test-school")?.id).toBe(created.bridgeId);
    const stored = localDb().prepare("SELECT token_hash FROM bridge_instances WHERE id=?").get(created.bridgeId) as {token_hash:string};
    expect(stored.token_hash).not.toContain(created.token);
  });

  it("atomically activates a catalog", () => {
    const version = publishCatalog("hguni-test-school", { students: [{id:"S1",name:"김학생",grade:1,classLabel:"2",number:3,sourceClass:"1",active:true}], items: [{key:"D:LATE",kind:"D",code:"LATE",label:"지각",signedPoints:-1,enabled:true}], teachers: [{id:"T1",name:"김교사",active:true}] }, "checksum");
    const active = localDb().prepare("SELECT id,status FROM catalog_versions WHERE status='active'").get() as {id:string;status:string};
    expect(active).toEqual({ id: version, status: "active" });
    expect((localDb().prepare("SELECT count(*) count FROM students").get() as {count:number}).count).toBe(1);
  });

  it("runs the live PIN to durable bridge-report flow", async () => {
    process.env.REAL_WRITES_ENABLED = "true";
    const bridge = createBridgeToken("test bridge", "test-admin");
    heartbeatBridge(bridge.bridgeId, { sqlReady: true, penalty: true, cancellation: true, version: "test" });
    const version = publishCatalog("hguni-test-school", { students: [{id:"S1",name:"김학생",grade:1,classLabel:"2",number:3,sourceClass:"1",active:true}], items: [{key:"D:LATE",kind:"D",code:"LATE",label:"지각",signedPoints:-1,enabled:true}], teachers: [{id:"T1",name:"김교사",active:true}] }, "checksum");
    const db = localDb();
    db.prepare("INSERT INTO activity_schedules(id,name,weekdays_json,start_local,end_local,enabled,created_at) VALUES ('all-day','등교지도','[0,1,2,3,4,5,6]','00:00','23:59',1,?)").run(new Date().toISOString());
    db.prepare("INSERT INTO schedule_items(schedule_id,item_key) VALUES ('all-day','D:LATE')").run();
    const pinHash = await argon2.hash(`123456:${process.env.PIN_PEPPER}`);
    db.prepare("UPDATE app_settings SET pin_hash=?,teacher_source_id='T1',paused=0 WHERE id=1").run(pinHash);
    const session = await localStore.unlock("123456", "tablet-1");
    await localStore.setRoster(session.token, ["학생회장"]);
    expect((await localStore.items(session.token)).version).toBe(version);
    const requestId = randomUUID();
    expect((await localStore.createPenalty(session.token, { requestId, studentId:"S1", itemKey:"D:LATE", catalogVersion:version })).state).toBe("queued");
    expect((await localStore.createPenalty(session.token, { requestId, studentId:"S1", itemKey:"D:LATE", catalogVersion:version })).requestId).toBe(requestId);
    await expect(localStore.createPenalty(session.token, { requestId, studentId:"OTHER", itemKey:"D:LATE", catalogVersion:version })).rejects.toThrow("REQUEST_ID_CONFLICT");
    const job = claimBridgeJob(bridge.bridgeId);
    expect(job?.requestId).toBe(requestId);
    expect(authorizeBridgeJob(job!.jobId, bridge.bridgeId, job!.leaseGeneration)).toBe(true);
    await localStore.requestCancellation(session.token,requestId,"잘못 선택함");
    await localStore.approveCancellation(requestId,"취소 승인","teacher-1");
    reportBridgeJob(job!.jobId, bridge.bridgeId, job!.leaseGeneration, { outcome:"succeeded", result:{sourceRecordId:"M1"} });
    expect((await localStore.penalty(session.token, requestId)).state).toBe("cancel_approved");
    const cancelJob=claimBridgeJob(bridge.bridgeId);
    expect(cancelJob?.operation).toBe("cancel");
    expect(authorizeBridgeJob(cancelJob!.jobId,bridge.bridgeId,cancelJob!.leaseGeneration)).toBe(true);
    reportBridgeJob(cancelJob!.jobId,bridge.bridgeId,cancelJob!.leaseGeneration,{outcome:"succeeded",result:{sourceRecordId:"M1",cancelled:true}});
    expect((await localStore.penalty(session.token,requestId)).state).toBe("cancel_succeeded");
  });
});
