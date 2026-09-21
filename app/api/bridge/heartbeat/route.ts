import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { requireBridge } from "@/lib/server/bridge-auth";
import { adminClient } from "@/lib/server/supabase";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";

const schema = z.object({ sqlReady: z.boolean(), penalty: z.boolean(), cancellation: z.boolean(), version: z.string().max(40) }).strict();
export async function POST(request: Request) {
  try { const bridge = await requireBridge(request); const input = await parseJson(request, schema); if (!isMockMode()) { const { error } = await adminClient().from("bridge_instances").update({ last_seen_at: new Date().toISOString(), sql_checked_at: input.sqlReady ? new Date().toISOString() : null, capabilities: { penalty: input.penalty, cancellation: input.cancellation }, version: input.version }).eq("id", bridge.id); if (error) throw error; } return ok({ bridgeId: bridge.id }); }
  catch (error) { return error instanceof Error && error.message.includes("BRIDGE_UNAUTHORIZED") ? fail("BRIDGE_UNAUTHORIZED", "중계 인증 또는 실행 환경이 올바르지 않습니다.", 401) : routeError(error); }
}
