import { cookies } from "next/headers";
import { COUNCIL_COOKIE, councilToken, store } from "@/lib/server/store";
import { assertSameOrigin } from "@/lib/server/csrf";
import { ok, routeError } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = await councilToken();
    if (token) await store().end(token);
    (await cookies()).set(COUNCIL_COOKIE, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
    return ok({ ended: true });
  } catch (error) { return routeError(error); }
}
