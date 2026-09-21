import { cookies } from "next/headers";
import { COUNCIL_COOKIE, store } from "@/lib/server/store";
import { parseJson, pinSchema } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { ok, routeError } from "@/lib/server/http";
import { storeError } from "@/lib/server/store-error";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { pin } = await parseJson(request, pinSchema);
    const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    const result = await store().unlock(pin, clientKey);
    (await cookies()).set(COUNCIL_COOKIE, result.token, {
      httpOnly: true, sameSite: "strict", secure: process.env.APP_ENV === "production", path: "/", expires: new Date(result.expiresAt),
    });
    return ok({ unlocked: true, expiresAt: result.expiresAt });
  } catch (error) { return storeError(error) ?? routeError(error); }
}
