import { councilToken, store } from "@/lib/server/store";
import { parseJson, penaltySchema } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { fail, ok, routeError } from "@/lib/server/http";
import { storeError } from "@/lib/server/store-error";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const token = await councilToken();
    if (!token) return fail("SESSION_REQUIRED", "교사가 활동을 다시 열어 주세요.", 401);
    const input = await parseJson(request, penaltySchema);
    return ok(await store().createPenalty(token, input), 202);
  } catch (error) { return storeError(error) ?? routeError(error); }
}
