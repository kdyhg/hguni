import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { localDb } = await import("../lib/server/local-db");
  const backupDir = path.resolve(process.env.HGUNI_BACKUP_DIR ?? "./backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(backupDir, `hguni-${stamp}.db`);
  await localDb().backup(destination);
  const backups = fs.readdirSync(backupDir).filter((name) => /^hguni-.*\.db$/.test(name)).sort().reverse();
  for (const name of backups.slice(30)) fs.unlinkSync(path.join(backupDir, name));
  console.log(JSON.stringify({ event: "backup_completed", destination, retained: Math.min(backups.length, 30) }));
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
