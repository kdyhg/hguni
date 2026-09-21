import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { TEACHER_COOKIE } from "./store";
import { isMockMode } from "./env";
import { adminClient } from "./supabase";

export type TeacherIdentity = { id: string; email: string; role: "admin" | "teacher" };

export async function signInTeacher(email: string, password: string) {
  if (isMockMode()) {
    if (email.toLowerCase() !== "admin@demo.local" || password !== "hguni-demo") throw new Error("LOGIN_FAILED");
    return { token: `mock.${randomBytes(24).toString("base64url")}`, expiresAt: new Date(Date.now() + 8 * 60 * 60_000), identity: { id: "mock-admin", email, role: "admin" as const } };
  }
  const client = adminClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.toLowerCase(), password });
  if (error || !data.session || !data.user) throw new Error("LOGIN_FAILED");
  const { data: profile, error: profileError } = await client.from("teacher_profiles").select("email,role,enabled").eq("auth_user_id", data.user.id).single();
  if (profileError || !profile?.enabled || !["admin", "teacher"].includes(profile.role)) throw new Error("ACCOUNT_DISABLED");
  return { token: data.session.access_token, expiresAt: new Date(data.session.expires_at! * 1000), identity: { id: data.user.id, email: profile.email, role: profile.role as "admin" | "teacher" } };
}

export async function currentTeacher(): Promise<TeacherIdentity | null> {
  const token = (await cookies()).get(TEACHER_COOKIE)?.value;
  if (!token) return null;
  if (isMockMode()) return token.startsWith("mock.") ? { id: "mock-admin", email: "admin@demo.local", role: "admin" } : null;
  const client = adminClient();
  const { data: userData, error } = await client.auth.getUser(token);
  if (error || !userData.user) return null;
  const { data: profile } = await client.from("teacher_profiles").select("email,role,enabled").eq("auth_user_id", userData.user.id).single();
  if (!profile?.enabled) return null;
  return { id: userData.user.id, email: profile.email, role: profile.role } as TeacherIdentity;
}

export async function requireTeacher(role?: "admin") {
  const identity = await currentTeacher();
  if (!identity || (role && identity.role !== role)) throw new Error("TEACHER_UNAUTHORIZED");
  return identity;
}
