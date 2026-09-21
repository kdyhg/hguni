import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

export function adminClient() {
  const config = env();
  if (!config.SUPABASE_URL || !config.SUPABASE_SECRET_KEY) {
    throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  }
  return createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}
