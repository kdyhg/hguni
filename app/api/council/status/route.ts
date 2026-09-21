import { councilToken, store } from "@/lib/server/store";
import { ok, routeError } from "@/lib/server/http";

export async function GET() {
  try { return ok(await store().status(await councilToken())); } catch (error) { return routeError(error); }
}
