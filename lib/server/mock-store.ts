import { createHash, randomBytes } from "node:crypto";
import type { AppStore, PenaltyInput } from "./store";
import type { PenaltyItem, PenaltyRecord, Student } from "@/lib/domain/contracts";

type Session = { tokenHash: string; roster: string[]; expiresAt: string; revoked: boolean };
type Attempt = { failures: number; blockedUntil: number };

const students: Student[] = [
  { id: "ST-2026-20312", name: "김민준", grade: 2, classLabel: "3", number: 12, sourceClass: "2026-2-3", active: true },
  { id: "ST-2026-10704", name: "김민준", grade: 1, classLabel: "7", number: 4, sourceClass: "2026-1-7", active: true },
  { id: "ST-2026-30118", name: "이지은", grade: 3, classLabel: "1", number: 18, sourceClass: "2026-3-1", active: true },
  { id: "ST-2026-20409", name: "박서준", grade: 2, classLabel: "4", number: 9, sourceClass: "2026-2-4", active: true },
  { id: "ST-2026-10521", name: "최유나", grade: 1, classLabel: "5", number: 21, sourceClass: "2026-1-5", active: true },
  { id: "ST-2026-30802", name: "정하람", grade: 3, classLabel: "8", number: 2, sourceClass: "2026-3-8", active: true },
];

const items: PenaltyItem[] = [
  { key: "D:UNIFORM", kind: "D", code: "UNIFORM", label: "복장불량", signedPoints: -2, enabled: true },
  { key: "D:PROXY", kind: "D", code: "PROXY", label: "대리출석", signedPoints: -3, enabled: true },
  { key: "D:LATE", kind: "D", code: "LATE", label: "지각", signedPoints: -1, enabled: true },
];

const state = globalThis as typeof globalThis & {
  __hguniMock?: { sessions: Map<string, Session>; records: Map<string, PenaltyRecord>; attempts: Map<string, Attempt>; pin: string };
};
state.__hguniMock ??= { sessions: new Map(), records: new Map(), attempts: new Map(), pin: process.env.MOCK_COUNCIL_PIN ?? "246810" };
state.__hguniMock.pin ??= process.env.MOCK_COUNCIL_PIN ?? "246810";
const db = state.__hguniMock;

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const now = () => new Date();

export function setMockPin(pin: string) {
  db.pin = pin;
  for (const value of db.sessions.values()) value.revoked = true;
}

function session(token: string) {
  const found = db.sessions.get(hash(token));
  if (!found || found.revoked || Date.parse(found.expiresAt) <= Date.now()) throw new Error("SESSION_INVALID");
  return found;
}

function recordFor(token: string, requestId: string) {
  session(token);
  const record = db.records.get(requestId);
  if (!record) throw new Error("NOT_FOUND");
  if (record.state === "queued" && Date.now() - Date.parse(record.createdAt) > 550) record.state = "succeeded";
  return structuredClone(record);
}

export const mockStore: AppStore = {
  async status(token) {
    const found = token ? db.sessions.get(hash(token)) : undefined;
    return {
      mode: "mock",
      activity: { id: "mock-morning", name: "아침 등교지도", startsAt: "07:40", endsAt: "08:30" },
      lockReason: null,
      session: { unlocked: Boolean(found && !found.revoked), roster: found?.roster ?? [] },
      bridgeReady: true,
    };
  },
  async unlock(pin, clientKey) {
    const attempt = db.attempts.get(clientKey) ?? { failures: 0, blockedUntil: 0 };
    if (attempt.blockedUntil > Date.now()) throw new Error("PIN_RATE_LIMITED");
    if (pin !== db.pin) {
      attempt.failures += 1;
      if (attempt.failures >= 5) attempt.blockedUntil = Date.now() + 5 * 60_000;
      db.attempts.set(clientKey, attempt);
      throw new Error(attempt.blockedUntil > Date.now() ? "PIN_RATE_LIMITED" : "PIN_INVALID");
    }
    db.attempts.delete(clientKey);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    db.sessions.set(hash(token), { tokenHash: hash(token), roster: [], expiresAt, revoked: false });
    return { token, expiresAt };
  },
  async setRoster(token, names) {
    const found = session(token);
    found.roster = [...names];
    return [...found.roster];
  },
  async students(token, query) {
    session(token);
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    return students.filter((student) => `${student.name} ${student.id} ${student.grade}${student.classLabel}${student.number}`.toLowerCase().includes(normalized)).slice(0, 20);
  },
  async items(token) {
    session(token);
    return { version: "mock-catalog-v1", items: structuredClone(items) };
  },
  async createPenalty(token, input: PenaltyInput) {
    const found = session(token);
    if (!found.roster.length) throw new Error("ROSTER_REQUIRED");
    const previous = db.records.get(input.requestId);
    if (previous) return structuredClone(previous);
    const student = students.find((value) => value.id === input.studentId && value.active);
    const item = items.find((value) => value.key === input.itemKey && value.enabled);
    if (!student || !item || input.catalogVersion !== "mock-catalog-v1") throw new Error("CATALOG_STALE");
    const duplicate = [...db.records.values()].find((value) => value.student.id === student.id && value.item.key === item.key && value.state !== "cancel_succeeded");
    if (duplicate) throw new Error("DUPLICATE_PENALTY");
    const record: PenaltyRecord = {
      id: randomBytes(12).toString("hex"),
      requestId: input.requestId,
      student: structuredClone(student),
      item: structuredClone(item),
      roster: [...found.roster],
      state: "queued",
      createdAt: now().toISOString(),
    };
    db.records.set(input.requestId, record);
    return structuredClone(record);
  },
  async penalty(token, requestId) { return recordFor(token, requestId); },
  async history(token) {
    session(token);
    return [...db.records.values()].map((record) => recordFor(token, record.requestId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async requestCancellation(token, requestId, reason) {
    const record = db.records.get(requestId);
    session(token);
    if (!record) throw new Error("NOT_FOUND");
    if (!reason.trim()) throw new Error("INVALID_INPUT");
    if (record.state !== "succeeded" && record.state !== "queued") throw new Error("CANCELLATION_INVALID");
    record.state = "cancel_requested";
    record.cancellationId = randomBytes(12).toString("hex");
    record.message = reason.trim();
    return structuredClone(record);
  },
  async end(token) { session(token).revoked = true; },
  async teacherHistory() {
    return [...db.records.values()].map((record) => structuredClone(record)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  async approveCancellation(requestId, reason) {
    const record = db.records.get(requestId);
    if (!record || record.state !== "cancel_requested") throw new Error("CANCELLATION_INVALID");
    record.state = "cancel_succeeded";
    record.message = reason.trim() || record.message;
    return structuredClone(record);
  },
  async rejectCancellation(requestId, reason) {
    const record = db.records.get(requestId);
    if (!record || record.state !== "cancel_requested") throw new Error("CANCELLATION_INVALID");
    record.state = "succeeded";
    record.message = reason.trim();
    return structuredClone(record);
  },
};
