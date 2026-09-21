import { councilToken, store } from "@/lib/server/store";
import { fail, ok, routeError } from "@/lib/server/http";
import { storeError } from "@/lib/server/store-error";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const token = await councilToken();
    if (!token) return fail("SESSION_REQUIRED", "교사가 활동을 다시 열어 주세요.", 401);
    const { id } = await context.params;
    return ok(await store().penalty(token, id));
  } catch (error) { return storeError(error) ?? routeError(error); }
}
