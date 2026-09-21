import { loadEnvConfig } from "@next/env";
import { google } from "googleapis";

loadEnvConfig(process.cwd());

const SHEET_TITLE = "아침선도 기록";
const HEADERS = [["처리시각", "요청ID", "상태", "학생ID", "학생명", "학년-반-번호", "항목", "점수", "학생회 담당자", "유니쿨 기록ID", "이벤트"]];

async function syncOnce() {
  const [{ env }, { localDb, json }] = await Promise.all([import("../lib/server/env"), import("../lib/server/local-db")]);
  const config = env();
  if (config.GOOGLE_SHEETS_ENABLED !== "true") return { synced: 0, disabled: true };
  const auth = new google.auth.GoogleAuth({ keyFile: config.GOOGLE_SERVICE_ACCOUNT_KEY_FILE, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = config.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const exists = meta.data.sheets?.some((sheet) => sheet.properties?.title === SHEET_TITLE);
  if (!exists) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title: SHEET_TITLE, gridProperties: { frozenRowCount: 1 } } } }] } });
    await sheets.spreadsheets.values.update({ spreadsheetId, range: `'${SHEET_TITLE}'!A1:K1`, valueInputOption: "RAW", requestBody: { values: HEADERS } });
  }
  const db = localDb();
  const pending = db.prepare("SELECT id,event_type,payload_json,created_at FROM google_sync_outbox WHERE state='pending' ORDER BY id LIMIT 100").all() as Array<{id:number;event_type:string;payload_json:string;created_at:string}>;
  if (!pending.length) return { synced: 0 };
  const values = pending.map((entry) => {
    const payload = json<Record<string, unknown>>(entry.payload_json, {});
    const student = (payload.student ?? {}) as Record<string, unknown>;
    const item = (payload.item ?? {}) as Record<string, unknown>;
    const result = (payload.result ?? {}) as Record<string, unknown>;
    const roster = Array.isArray(payload.roster) ? payload.roster.join(", ") : "";
    return [entry.created_at, payload.requestId ?? "", payload.state ?? "", student.id ?? "", student.name ?? "", `${student.grade ?? ""}-${student.classLabel ?? ""}-${student.number ?? ""}`, item.label ?? "", item.signedPoints ?? "", roster, result.sourceRecordId ?? "", entry.event_type];
  });
  try {
    await sheets.spreadsheets.values.append({ spreadsheetId, range: `'${SHEET_TITLE}'!A:K`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values } });
    const mark = db.prepare("UPDATE google_sync_outbox SET state='synced',synced_at=?,last_error=NULL WHERE id=?");
    db.transaction(() => {
      for (const entry of pending) mark.run(new Date().toISOString(), entry.id);
      db.prepare("DELETE FROM google_sync_outbox WHERE state='synced' AND synced_at<datetime('now','-30 days')").run();
    })();
    return { synced: pending.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Google Sheets 동기화 실패";
    const mark = db.prepare("UPDATE google_sync_outbox SET attempts=attempts+1,last_error=? WHERE id=?");
    db.transaction(() => { for (const entry of pending) mark.run(message, entry.id); })();
    throw error;
  }
}

async function main() {
  const watch = process.argv.includes("--watch");
  do {
    try { console.log(JSON.stringify({ event: "google_sheets_sync", ...(await syncOnce()) })); }
    catch (error) {
      console.error(JSON.stringify({ event: "google_sheets_sync_failed", message: error instanceof Error ? error.message : "unknown" }));
      if (!watch) throw error;
    }
    if (watch) await new Promise((resolve) => setTimeout(resolve, 60_000));
  } while (watch);
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
