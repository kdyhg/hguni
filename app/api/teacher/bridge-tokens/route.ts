import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { isMockMode } from "@/lib/server/env";
import { fail,ok,routeError } from "@/lib/server/http";
import { createBridgeToken } from "@/lib/server/local-bridge";
import { requireTeacher } from "@/lib/server/teacher-auth";

const schema=z.object({label:z.string().trim().min(1).max(60).default("학교 PC 중계")}).strict();
export async function POST(request:Request) {
  try {
    assertSameOrigin(request);
    const actor=await requireTeacher("admin");
    const {label}=await parseJson(request,schema);
    return ok(isMockMode()?{token:process.env.MOCK_BRIDGE_TOKEN??"mock-bridge-token-for-development",bridgeId:"00000000-0000-4000-8000-000000000001"}:createBridgeToken(label,actor.id),201);
  } catch(error) {
    return error instanceof Error&&error.message.includes("TEACHER_UNAUTHORIZED")?fail("FORBIDDEN","관리자 권한이 필요합니다.",403):routeError(error);
  }
}
