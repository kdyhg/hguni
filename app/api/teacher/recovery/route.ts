import { z } from "zod";
import { parseJson } from "@/lib/domain/validation";
import { assertSameOrigin } from "@/lib/server/csrf";
import { ok } from "@/lib/server/http";
import { isMockMode, env } from "@/lib/server/env";
import { adminClient } from "@/lib/server/supabase";

const schema = z.object({ email: z.string().email().max(254) }).strict();
export async function POST(request: Request) {
  try { assertSameOrigin(request); const { email } = await parseJson(request, schema); if (!isMockMode()) await adminClient().auth.resetPasswordForEmail(email.toLowerCase(), { redirectTo: `${env().APP_BASE_URL}/teacher/reset-password` }); } catch { /* Deliberately keep account existence private. */ }
  return ok({ requested: true });
}
