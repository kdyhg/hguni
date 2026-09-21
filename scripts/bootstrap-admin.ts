import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const [{ bootstrapLocalAdmin }, { env }] = await Promise.all([import("../lib/server/local-accounts"), import("../lib/server/env")]);
  const config = env();
  const email = config.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = config.BOOTSTRAP_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("BOOTSTRAP_ADMIN_EMAIL과 BOOTSTRAP_ADMIN_PASSWORD를 설정하세요.");
  await bootstrapLocalAdmin(email, password);
  console.log(JSON.stringify({ event: "bootstrap_admin_completed", email, database: config.LOCAL_DATABASE_PATH }));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
