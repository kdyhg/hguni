import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { ok } from "@/lib/server/http";

const schema = z.object({ email: z.string().email().max(254) }).strict();
export async function POST(request: Request) {
  try { assertSameOrigin(request); await parseJson(request, schema); } catch { /* 계정 존재 여부는 공개하지 않습니다. */ }
  return ok({ requested: true, delivery: "local-admin" });
}
