import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { TEACHER_COOKIE } from "./store";
import { isMockMode } from "./env";
import { audit, localDb } from "./local-db";

export type TeacherIdentity = { id: string; email: string; role: "admin" | "teacher" };
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export async function signInTeacher(email: string, password: string) {
  if (isMockMode()) {
    if (email.toLowerCase() !== "admin@demo.local" || password !== "hguni-demo") throw new Error("LOGIN_FAILED");
    return { token: `mock.${randomBytes(24).toString("base64url")}`, expiresAt: new Date(Date.now() + 8 * 60 * 60_000), identity: { id: "mock-admin", email, role: "admin" as const } };
  }
  const normalized = email.trim().toLowerCase();
  const account = localDb().prepare("SELECT id,email,password_hash,role,enabled FROM teacher_accounts WHERE email=?").get(normalized) as { id: string; email: string; password_hash: string; role: "admin" | "teacher"; enabled: number } | undefined;
  if (!account || !(await argon2.verify(account.password_hash, password))) throw new Error("LOGIN_FAILED");
  if (!account.enabled) throw new Error("ACCOUNT_DISABLED");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 8 * 60 * 60_000);
  const db = localDb();
  db.prepare("DELETE FROM teacher_sessions WHERE expires_at<=?").run(new Date().toISOString());
  db.prepare("INSERT INTO teacher_sessions(token_hash,teacher_id,expires_at,created_at) VALUES (?,?,?,?)").run(hash(token), account.id, expiresAt.toISOString(), new Date().toISOString());
  audit("teacher", "session.opened", account.id, randomUUID());
  return { token, expiresAt, identity: { id: account.id, email: account.email, role: account.role } };
}

export async function currentTeacher(): Promise<TeacherIdentity | null> {
  const token = (await cookies()).get(TEACHER_COOKIE)?.value;
  if (!token) return null;
  if (isMockMode()) return token.startsWith("mock.") ? { id: "mock-admin", email: "admin@demo.local", role: "admin" } : null;
  const row = localDb().prepare(`
    SELECT a.id,a.email,a.role,a.enabled,s.expires_at
    FROM teacher_sessions s JOIN teacher_accounts a ON a.id=s.teacher_id
    WHERE s.token_hash=?
  `).get(hash(token)) as { id: string; email: string; role: "admin" | "teacher"; enabled: number; expires_at: string } | undefined;
  if (!row || !row.enabled || Date.parse(row.expires_at) <= Date.now()) return null;
  return { id: row.id, email: row.email, role: row.role };
}

export function revokeTeacherSession(token: string) {
  if (isMockMode()) return;
  localDb().prepare("DELETE FROM teacher_sessions WHERE token_hash=?").run(hash(token));
}

export async function requireTeacher(role?: "admin") {
  const identity = await currentTeacher();
  if (!identity || (role && identity.role !== role)) throw new Error("TEACHER_UNAUTHORIZED");
  return identity;
}
