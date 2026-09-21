import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { requireBridge } from "@/lib/server/bridge-auth";
import { isMockMode } from "@/lib/server/env";
import { fail,ok,routeError } from "@/lib/server/http";
import { reconcileBridgeJob } from "@/lib/server/local-bridge";

const schema=z.object({leaseGeneration:z.number().int().positive(),outcome:z.enum(["succeeded","failed_safe","uncertain","manual_required"]),result:z.record(z.string(),z.unknown())}).strict();
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
  try {
    const bridge=await requireBridge(request);
    const{id}=await context.params;
    const input=await parseJson(request,schema);
    if(!isMockMode()) reconcileBridgeJob(id, bridge.id, { outcome: input.outcome, result: input.result });
    return ok({reconciled:true});
  } catch(error) {
    return error instanceof Error&&error.message.includes("BRIDGE_UNAUTHORIZED")
      ? fail("BRIDGE_UNAUTHORIZED","중계 인증 또는 실행 환경이 올바르지 않습니다.",401)
      : routeError(error);
  }
}
