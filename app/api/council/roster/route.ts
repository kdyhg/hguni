import { councilToken, store } from "@/lib/server/store";
import { parseJson, rosterSchema } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { storeError } from "@/lib/server/store-error";

export async function PUT(request: Request) {
  try {
    assertSameOrigin(request);
    const token = await councilToken();
    if (!token) return fail("SESSION_REQUIRED", "교사가 활동을 다시 열어 주세요.", 401);
    const { names } = await parseJson(request, rosterSchema);
    return ok({ names: await store().setRoster(token, names) });
  } catch (error) { return storeError(error) ?? routeError(error); }
}
