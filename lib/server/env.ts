import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  USE_MOCK_DATA: z.enum(["true", "false"]).default("false"),
  SUPABASE_URL: z.string().url().optional().or(z.literal("")),
  SUPABASE_SECRET_KEY: z.string().optional(),
  PIN_PEPPER: z.string().min(32).optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  SOURCE_SCOPE: z.string().min(3).default("hguni-development"),
  REAL_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
});

export function env() {
  const parsed = schema.parse(process.env);
  if (parsed.APP_ENV === "production" && parsed.USE_MOCK_DATA === "true") {
    throw new Error("운영 환경에서는 mock 데이터를 사용할 수 없습니다.");
  }
  if (parsed.REAL_WRITES_ENABLED === "true" && parsed.APP_ENV !== "production") {
    throw new Error("실제 쓰기는 production 환경에서만 활성화할 수 있습니다.");
  }
  return parsed;
}

export function isMockMode() {
  return env().APP_ENV !== "production" && env().USE_MOCK_DATA === "true";
}
