import { ok } from "@/lib/server/http";
import { localDb } from "@/lib/server/local-db";
import { env } from "@/lib/server/env";

export async function GET() {
  const db = localDb();
  const integrity = db.pragma("quick_check", { simple: true });
  const pending = (db.prepare("SELECT count(*) count FROM google_sync_outbox WHERE state='pending'").get() as { count:number }).count;
  return ok({ status: integrity === "ok" ? "ok" : "degraded", storage: "sqlite", sqlite: integrity, googleSheets: { enabled: env().GOOGLE_SHEETS_ENABLED === "true", pending } });
}
