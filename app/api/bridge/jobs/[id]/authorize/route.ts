import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { requireBridge } from "@/lib/server/bridge-auth";
import { env, isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { authorizeBridgeJob } from "@/lib/server/local-bridge";

const schema=z.object({leaseGeneration:z.number().int().positive()}).strict();
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const bridge=await requireBridge(request);
    const{id}=await context.params;
    const input=await parseJson(request,schema);
    const authorized=!isMockMode() && env().REAL_WRITES_ENABLED==="true" && authorizeBridgeJob(id, bridge.id, input.leaseGeneration);
    return ok({authorized});
  } catch(error) {
    return error instanceof Error&&error.message.includes("BRIDGE_UNAUTHORIZED")
      ? fail("BRIDGE_UNAUTHORIZED","중계 인증 또는 실행 환경이 올바르지 않습니다.",401)
      : routeError(error);
  }
}
