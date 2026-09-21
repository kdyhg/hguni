import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { audit, localDb } from "./local-db";
import { env } from "./env";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

export type LocalInvitation = { id: string; email: string; role: "admin" | "teacher"; status: string; issuedAt: string; inviteUrl?: string };

export function listLocalInvitations(): LocalInvitation[] {
  const rows = localDb().prepare("SELECT id,email,role,status,issued_at,expires_at FROM teacher_invitations ORDER BY issued_at DESC LIMIT 100").all() as Array<{ id:string;email:string;role:"admin"|"teacher";status:string;issued_at:string;expires_at:string }>;
  const now = Date.now();
  return rows.map((row) => ({ id: row.id, email: row.email, role: row.role, status: row.status === "pending" && Date.parse(row.expires_at) <= now ? "expired" : row.status, issuedAt: row.issued_at }));
}

export function createLocalInvitation(email: string, role: "admin" | "teacher", invitedBy: string): LocalInvitation {
  const normalized = email.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const id = randomUUID();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 24 * 60 * 60_000);
  localDb().transaction(() => {
    localDb().prepare("UPDATE teacher_invitations SET status='revoked' WHERE email=? AND status='pending'").run(normalized);
    localDb().prepare(`
      INSERT INTO teacher_invitations(id,email,role,token_hash,status,invited_by,issued_at,expires_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(id, normalized, role, hash(token), "pending", invitedBy, issuedAt.toISOString(), expiresAt.toISOString());
    audit("teacher", "invitation.created", invitedBy, id, { email: normalized, role });
  })();
  return { id, email: normalized, role, status: "pending", issuedAt: issuedAt.toISOString(), inviteUrl: `${env().APP_BASE_URL}/teacher/accept-invite?token=${encodeURIComponent(token)}` };
}

export async function acceptLocalInvitation(token: string, password: string) {
  const db = localDb();
  const invitation = db.prepare("SELECT id,email,role,status,expires_at FROM teacher_invitations WHERE token_hash=?").get(hash(token)) as { id:string;email:string;role:"admin"|"teacher";status:string;expires_at:string } | undefined;
  if (!invitation || invitation.status !== "pending" || Date.parse(invitation.expires_at) <= Date.now()) throw new Error("INVITATION_INVALID");
  const passwordHash = await argon2.hash(password);
  db.transaction(() => {
    const existing = db.prepare("SELECT id,role FROM teacher_accounts WHERE email=?").get(invitation.email) as { id:string;role:"admin"|"teacher" } | undefined;
    const accountId = existing?.id ?? randomUUID();
    if (existing) db.prepare("UPDATE teacher_accounts SET password_hash=?,role=?,enabled=1,updated_at=? WHERE id=?").run(passwordHash, existing.role, new Date().toISOString(), accountId);
    else db.prepare(`INSERT INTO teacher_accounts(id,email,password_hash,role,enabled,created_at,updated_at) VALUES (?,?,?,?,1,?,?)`).run(accountId, invitation.email, passwordHash, invitation.role, new Date().toISOString(), new Date().toISOString());
    db.prepare("UPDATE teacher_invitations SET status='accepted',accepted_at=? WHERE id=?").run(new Date().toISOString(), invitation.id);
    audit("teacher", "invitation.accepted", accountId, invitation.id);
  })();
}

export function revokeLocalInvitation(id: string, actorId: string) {
  localDb().prepare("UPDATE teacher_invitations SET status='revoked' WHERE id=? AND status='pending'").run(id);
  audit("teacher", "invitation.revoked", actorId, id);
}

export function updateLocalTeacher(id: string, input: { role?: "admin" | "teacher"; enabled?: boolean }, actorId: string) {
  const db = localDb();
  db.transaction(() => {
    const target = db.prepare("SELECT role,enabled FROM teacher_accounts WHERE id=?").get(id) as { role:"admin"|"teacher";enabled:number } | undefined;
    if (!target) throw new Error("NOT_FOUND");
    const nextRole = input.role ?? target.role;
    const nextEnabled = input.enabled ?? Boolean(target.enabled);
    if (target.role === "admin" && (!nextEnabled || nextRole !== "admin")) {
      const admins = db.prepare("SELECT count(*) count FROM teacher_accounts WHERE role='admin' AND enabled=1").get() as { count:number };
      if (admins.count <= 1) throw new Error("LAST_ADMIN_REQUIRED");
    }
    db.prepare("UPDATE teacher_accounts SET role=?,enabled=?,updated_at=? WHERE id=?").run(nextRole, Number(nextEnabled), new Date().toISOString(), id);
    if (!nextEnabled) db.prepare("DELETE FROM teacher_sessions WHERE teacher_id=?").run(id);
    audit("teacher", "teacher.updated", actorId, id, input);
  })();
}

export async function bootstrapLocalAdmin(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const passwordHash = await argon2.hash(password);
  const now = new Date().toISOString();
  const existing = localDb().prepare("SELECT id FROM teacher_accounts WHERE email=?").get(normalized) as { id:string } | undefined;
  if (existing) localDb().prepare("UPDATE teacher_accounts SET password_hash=?,role='admin',enabled=1,updated_at=? WHERE id=?").run(passwordHash, now, existing.id);
  else localDb().prepare(`INSERT INTO teacher_accounts(id,email,password_hash,role,enabled,created_at,updated_at) VALUES (?,?,?,'admin',1,?,?)`).run(randomUUID(), normalized, passwordHash, now, now);
}
