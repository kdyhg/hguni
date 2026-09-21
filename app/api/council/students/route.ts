import { councilToken, store } from "@/lib/server/store";
import { fail, ok, routeError } from "@/lib/server/http";
import { storeError } from "@/lib/server/store-error";

export async function GET(request: Request) {
  try {
    const token = await councilToken();
    if (!token) return fail("SESSION_REQUIRED", "교사가 활동을 다시 열어 주세요.", 401);
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2 || query.length > 40) return ok([]);
    return ok(await store().students(token, query));
  } catch (error) { return storeError(error) ?? routeError(error); }
}
