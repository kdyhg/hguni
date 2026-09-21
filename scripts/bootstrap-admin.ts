import { adminClient } from "../lib/server/supabase";
import { env } from "../lib/server/env";

async function main() {
  const email = env().BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("BOOTSTRAP_ADMIN_EMAIL을 설정하세요.");
  const client = adminClient();
  const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((value) => value.email?.toLowerCase() === email && value.email_confirmed_at);
  if (!user) throw new Error("이메일이 확인된 Auth 계정을 찾을 수 없습니다. 먼저 Dashboard에서 초대하세요.");
  const { error: profileError } = await client.from("teacher_profiles").upsert({ auth_user_id: user.id, email, role: "admin", enabled: true }, { onConflict: "auth_user_id" });
  if (profileError) throw profileError;
  console.log(JSON.stringify({ event: "bootstrap_admin_completed", authUserId: user.id, email }));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
