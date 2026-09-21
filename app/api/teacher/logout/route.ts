import { cookies } from "next/headers";
import { TEACHER_COOKIE } from "@/lib/server/store";
import { assertSameOrigin } from "@/lib/server/csrf";
import { ok } from "@/lib/server/http";
import { revokeTeacherSession } from "@/lib/server/teacher-auth";

export async function POST(request: Request) {
  assertSameOrigin(request);
  const jar = await cookies();
  const token = jar.get(TEACHER_COOKIE)?.value;
  if (token) revokeTeacherSession(token);
  jar.set(TEACHER_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return ok({ signedOut: true });
}
