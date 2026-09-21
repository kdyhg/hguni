import { createHash } from "node:crypto";
import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { requireBridge } from "@/lib/server/bridge-auth";
import { isMockMode } from "@/lib/server/env";
import { fail, ok, routeError } from "@/lib/server/http";
import { publishCatalog } from "@/lib/server/local-bridge";

const student = z.object({ id:z.string(),name:z.string(),grade:z.number().int(),classLabel:z.string(),number:z.number().int(),sourceClass:z.string(),active:z.boolean() }).strict();
const item = z.object({ key:z.string(),kind:z.literal("D"),code:z.string(),label:z.string(),signedPoints:z.number(),enabled:z.boolean() }).strict();
const teacher = z.object({ id:z.string(),name:z.string(),active:z.boolean() }).strict();
const schema = z.object({ catalog:z.object({ students:z.array(student).max(10000),items:z.array(item).max(1000),teachers:z.array(teacher).max(1000) }).strict() }).strict();

export async function POST(request: Request) {
  try {
    const bridge = await requireBridge(request);
    const { catalog } = await parseJson(request, schema);
    const checksum = createHash("sha256").update(JSON.stringify(catalog)).digest("hex");
    return ok({ version: isMockMode() ? `mock-${checksum.slice(0,12)}` : publishCatalog(bridge.scope, catalog, checksum) });
  } catch (error) {
    return error instanceof Error && error.message.includes("BRIDGE_UNAUTHORIZED")
      ? fail("BRIDGE_UNAUTHORIZED", "중계 인증 또는 실행 환경이 올바르지 않습니다.", 401)
      : routeError(error);
  }
}
