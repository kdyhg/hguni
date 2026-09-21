import { requireBridge } from "@/lib/server/bridge-auth";
import { adminClient } from "@/lib/server/supabase";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
export async function POST(request:Request){try{const bridge=await requireBridge(request);if(isMockMode())return ok(null);const{data,error}=await adminClient().rpc("hguni_claim_job",{p_bridge_id:bridge.id,p_lease_seconds:20});if(error)throw error;return ok(data);}catch(error){return error instanceof Error&&error.message.includes("BRIDGE_UNAUTHORIZED")?fail("BRIDGE_UNAUTHORIZED","중계 인증 또는 실행 환경이 올바르지 않습니다.",401):routeError(error);}}
