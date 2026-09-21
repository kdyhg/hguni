import { cookies } from "next/headers";
import { TEACHER_COOKIE } from "@/lib/server/store";
import { parseJson, loginSchema } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { signInTeacher } from "@/lib/server/teacher-auth";
import { env } from "@/lib/server/env";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const input = await parseJson(request, loginSchema);
    const result = await signInTeacher(input.email, input.password);
    (await cookies()).set(TEACHER_COOKIE, result.token, { httpOnly: true, sameSite: "lax", secure: env().COOKIE_SECURE === "true", path: "/", expires: result.expiresAt });
    return ok({ identity: result.identity });
  } catch (error) {
    if (error instanceof Error && error.message.includes("LOGIN_FAILED")) return fail("LOGIN_FAILED", "이메일 또는 비밀번호를 확인하세요.", 401);
    if (error instanceof Error && error.message.includes("ACCOUNT_DISABLED")) return fail("ACCOUNT_DISABLED", "사용할 수 없는 교사 계정입니다.", 403);
    return routeError(error);
  }
}
