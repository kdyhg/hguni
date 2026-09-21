import { cookies } from "next/headers";
import { TEACHER_COOKIE } from "@/lib/server/store";
import { assertSameOrigin } from "@/lib/server/csrf";
import { ok } from "@/lib/server/http";

export async function POST(request: Request) {
  assertSameOrigin(request);
  (await cookies()).set(TEACHER_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return ok({ signedOut: true });
}
