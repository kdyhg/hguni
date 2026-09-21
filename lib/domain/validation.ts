import { z } from "zod";

export const pinSchema = z.object({ pin: z.string().regex(/^\d{6}$/) }).strict();
export const rosterSchema = z.object({
  names: z.array(z.string().trim().min(1).max(30)).min(1).max(10).refine(
    (names) => new Set(names.map((name) => name.trim())).size === names.length,
    "담당자 이름이 중복되었습니다.",
  ),
}).strict();
export const penaltySchema = z.object({
  requestId: z.string().uuid(),
  studentId: z.string().min(1).max(120),
  itemKey: z.string().min(1).max(120),
  catalogVersion: z.string().min(1).max(120),
}).strict();
export const cancellationSchema = z.object({ reason: z.string().trim().min(2).max(300) }).strict();
export const loginSchema = z.object({ email: z.string().email().max(254), password: z.string().min(8).max(256) }).strict();

export async function parseJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new Error("JSON 요청만 허용됩니다.");
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 16_384) throw new Error("요청 본문이 너무 큽니다.");
  return schema.parse(await request.json());
}
