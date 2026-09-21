import { z } from "zod";

const schema = z.object({
  APP_ENV: z.enum(["development", "preview", "production"]).default("development"),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  USE_MOCK_DATA: z.enum(["true", "false"]).default("false"),
  LOCAL_DATABASE_PATH: z.string().min(1).default("./data/hguni.db"),
  PIN_PEPPER: z.string().min(32).optional(),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional().or(z.literal("")),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(8).optional(),
  SOURCE_SCOPE: z.string().min(3).default("hguni-development"),
  REAL_WRITES_ENABLED: z.enum(["true", "false"]).default("false"),
  GOOGLE_SHEETS_ENABLED: z.enum(["true", "false"]).default("false"),
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional().or(z.literal("")),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE: z.string().optional().or(z.literal("")),
});

export function env() {
  const parsed = schema.parse(process.env);
  if (parsed.APP_ENV === "production" && parsed.USE_MOCK_DATA === "true") {
    throw new Error("운영 환경에서는 mock 데이터를 사용할 수 없습니다.");
  }
  if (parsed.REAL_WRITES_ENABLED === "true" && parsed.APP_ENV !== "production") {
    throw new Error("실제 쓰기는 production 환경에서만 활성화할 수 있습니다.");
  }
  if (parsed.GOOGLE_SHEETS_ENABLED === "true" && (!parsed.GOOGLE_SHEETS_SPREADSHEET_ID || !parsed.GOOGLE_SERVICE_ACCOUNT_KEY_FILE)) {
    throw new Error("Google Sheets 동기화에는 스프레드시트 ID와 서비스 계정 키 파일이 필요합니다.");
  }
  return parsed;
}

export function isMockMode() {
  return env().APP_ENV !== "production" && env().USE_MOCK_DATA === "true";
}
