import { requireBridge } from "@/lib/server/bridge-auth";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { claimBridgeJob } from "@/lib/server/local-bridge";

export async function POST(request:Request) {
  try {
    const bridge = await requireBridge(request);
    return ok(isMockMode() ? null : claimBridgeJob(bridge.id));
  } catch (error) {
    return error instanceof Error && error.message.includes("BRIDGE_UNAUTHORIZED")
      ? fail("BRIDGE_UNAUTHORIZED", "중계 인증 또는 실행 환경이 올바르지 않습니다.", 401)
      : routeError(error);
  }
}
