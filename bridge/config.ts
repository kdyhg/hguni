import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  apiBaseUrl: z.string().url(),
  bridgeToken: z.string().min(24),
  sourceScope: z.string().min(3),
  mode: z.enum(["mock", "sqlserver"]),
  pollActiveMs: z.number().int().min(1000).max(30_000).default(2000),
  pollIdleMs: z.number().int().min(2000).max(60_000).default(15000),
  sql: z.object({
    host: z.string().min(1), database: z.string().min(1), port: z.number().int().min(1).max(65535).default(1433), user: z.string().min(1), password: z.string().min(1), encrypt: z.boolean().default(true), trustServerCertificate: z.boolean().default(false), schemaVerified: z.boolean().default(false), realWritesEnabled: z.boolean().default(false), cancellationVerified: z.boolean().default(false),
  }).optional(),
});

export type BridgeConfig = z.infer<typeof schema>;

export function loadConfig(): BridgeConfig {
  const location = process.env.HGUNI_BRIDGE_CONFIG ?? path.join(process.cwd(), "bridge", "config", "config.local.json");
  const config = schema.parse(JSON.parse(fs.readFileSync(location, "utf8")));
  if (config.mode === "sqlserver" && !config.sql) throw new Error("sqlserver 모드에는 sql 설정이 필요합니다.");
  if (config.mode === "mock" && config.sql?.realWritesEnabled) throw new Error("mock 모드와 실제 쓰기를 함께 사용할 수 없습니다.");
  if (config.sourceScope.includes("production") && config.mode === "mock") throw new Error("운영 scope에서 mock 중계를 사용할 수 없습니다.");
  return config;
}
