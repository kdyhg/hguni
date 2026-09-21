import sql from "mssql";
import type { BridgeConfig } from "./config";
import type { BridgeAdapter, BridgeJob, BridgeOutcome, Catalog, Receipt } from "./types";

class ReviewRequired extends Error {}

export class SqlServerAdapter implements BridgeAdapter {
  private readonly pool: sql.ConnectionPool;
  private readonly config: NonNullable<BridgeConfig["sql"]>;
  constructor(private readonly bridgeConfig: BridgeConfig) {
    if (!bridgeConfig.sql) throw new Error("SQL 설정이 없습니다.");
    this.config = bridgeConfig.sql;
    if (!this.config.schemaVerified) throw new Error("실제 스키마 확인 후 schemaVerified=true로 설정하세요.");
    this.pool = new sql.ConnectionPool({ server: this.config.host, port: this.config.port, database: this.config.database, user: this.config.user, password: this.config.password, options: { encrypt: this.config.encrypt, trustServerCertificate: this.config.trustServerCertificate }, pool: { min: 0, max: 2 }, requestTimeout: 20_000 });
  }
  private async connect() { if (!this.pool.connected) await this.pool.connect(); }
  async health() {
    await this.connect();
    const result = await this.pool.request().query("SELECT data_scope FROM dbo.HguniControl WHERE id=1; SELECT HAS_PERMS_BY_NAME('dbo.merit','OBJECT','INSERT') can_insert,HAS_PERMS_BY_NAME('dbo.merit','OBJECT','DELETE') can_delete,HAS_PERMS_BY_NAME('dbo.HguniReceipt','OBJECT','INSERT') can_receipt");
    const sets = result.recordsets as sql.IRecordSet<Record<string, unknown>>[];
    if (String(sets[0]?.[0]?.data_scope) !== this.bridgeConfig.sourceScope) throw new Error("SQL Server source scope가 설정과 다릅니다.");
    const perms = sets[1]?.[0];
    const penalty = this.config.realWritesEnabled && perms?.can_insert === 1 && perms?.can_receipt === 1;
    const cancellation = penalty && this.config.cancellationVerified && perms?.can_delete === 1;
    return { sqlReady: true, penalty, cancellation, sourceScope: this.bridgeConfig.sourceScope };
  }
  async listCatalog(): Promise<Catalog> {
    await this.connect();
    const [studentRows, teacherRows, itemRows] = await Promise.all([
      this.pool.request().query("SELECT st_id,name,class,ban,num,state FROM dbo.student ORDER BY st_id"),
      this.pool.request().query("SELECT key_num,t_name FROM dbo.teacher ORDER BY key_num"),
      this.pool.request().query("SELECT m_sel_code,mr_code,mr_text,mr_point FROM dbo.meritcode WHERE m_sel_code='D' ORDER BY mr_code"),
    ]);
    return {
      students: studentRows.recordset.map((row) => ({ id: String(row.st_id).trim(), name: String(row.name).trim(), grade: Number(String(row.class).trim()), classLabel: String(row.ban).trim(), number: Number(String(row.num).trim()), sourceClass: String(row.class).trim(), active: String(row.state).trim() === "Y" })),
      teachers: teacherRows.recordset.map((row) => ({ id: String(row.key_num).trim(), name: String(row.t_name).trim(), active: true })),
      items: itemRows.recordset.map((row) => ({ key: `D:${String(row.mr_code).trim()}`, kind: "D" as const, code: String(row.mr_code).trim(), label: String(row.mr_text).trim(), signedPoints: Number(row.mr_point), enabled: true })),
    };
  }
  async lookupReceipt(requestId: string): Promise<Receipt | null> {
    await this.connect(); const value = await this.pool.request().input("id", sql.UniqueIdentifier, requestId).query("SELECT request_id,operation,source_scope,payload_hash,source_record_id,result_json FROM dbo.HguniReceipt WHERE request_id=@id"); const row = value.recordset[0];
    return row ? { requestId: String(row.request_id), operation: String(row.operation), sourceScope: String(row.source_scope), payloadHash: String(row.payload_hash), sourceRecordId: row.source_record_id ? String(row.source_record_id) : null, result: JSON.parse(String(row.result_json)) } : null;
  }
  async applyPenalty(job: BridgeJob) { return this.write(job, false); }
  async cancelPenalty(job: BridgeJob) { if (!this.config.cancellationVerified) return { outcome: "manual_required", result: { message: "운영 자동 취소가 검증되지 않았습니다." } } as BridgeOutcome; return this.write(job, true); }
  private async write(job: BridgeJob, cancellation: boolean): Promise<BridgeOutcome> {
    if (!this.config.realWritesEnabled) return { outcome: "failed_safe", result: { message: "실제 쓰기가 비활성화되어 있습니다." } };
    await this.connect(); const tx = new sql.Transaction(this.pool); let began = false;
    try {
      await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE); began = true;
      const existing = await tx.request().input("id", sql.UniqueIdentifier, job.requestId).query("SELECT operation,source_scope,payload_hash,source_record_id,result_json FROM dbo.HguniReceipt WITH (UPDLOCK,HOLDLOCK) WHERE request_id=@id");
      if (existing.recordset.length) {
        const row = existing.recordset[0]; if (String(row.source_scope) !== this.bridgeConfig.sourceScope || String(row.payload_hash) !== job.payloadHash || String(row.operation) !== job.operation) throw new ReviewRequired("영수증 내용이 현재 작업과 다릅니다.");
        await tx.commit(); began = false; return { outcome: "succeeded", result: JSON.parse(String(row.result_json)) };
      }
      if (job.payload.sourceScope !== this.bridgeConfig.sourceScope) throw new ReviewRequired("작업 source scope가 다릅니다.");
      const student = await tx.request().input("sid", sql.VarChar(100), job.payload.student.id).query("SELECT st_id,name,class,ban,num,state FROM dbo.student WITH (HOLDLOCK) WHERE st_id=@sid");
      const current = student.recordset[0]; const saved = job.payload.student;
      if (!current || String(current.name).trim() !== saved.name || String(current.class).trim() !== saved.sourceClass || String(current.ban).trim() !== saved.classLabel || Number(current.num) !== saved.number || (!cancellation && String(current.state).trim() !== "Y")) throw new ReviewRequired("학생 정보가 동기화 시점과 다릅니다.");
      const teacher = await tx.request().input("tid", sql.VarChar(100), job.payload.teacherSourceId).query("SELECT key_num FROM dbo.teacher WITH (HOLDLOCK) WHERE key_num=@tid");
      if (teacher.recordset.length !== 1) throw new ReviewRequired("부과 교사를 원본에서 확인할 수 없습니다.");
      let result: Record<string, unknown>;
      if (!cancellation) {
        const item = await tx.request().input("code", sql.VarChar(100), job.payload.item.code).query("SELECT mr_text,mr_point FROM dbo.meritcode WITH (HOLDLOCK) WHERE m_sel_code='D' AND mr_code=@code");
        if (item.recordset.length !== 1 || String(item.recordset[0].mr_text).trim() !== job.payload.item.label || Number(item.recordset[0].mr_point) !== job.payload.item.signedPoints) throw new ReviewRequired("벌점 항목 또는 배점이 바뀌었습니다.");
        const korea = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date()); const part = (name: string) => korea.find((value) => value.type === name)!.value; const date = `${part("year")}-${part("month")}-${part("day")}`; const time = `${part("hour")}${part("minute")}${part("second")}`;
        const inserted = await tx.request().input("date", sql.VarChar(10), date).input("time", sql.VarChar(6), time).input("sid", sql.VarChar(100), saved.id).input("code", sql.VarChar(100), job.payload.item.code).input("text", sql.NVarChar(2000), job.payload.item.label).input("points", sql.Decimal(8,2), job.payload.item.signedPoints).input("teacher", sql.VarChar(100), job.payload.teacherSourceId).input("sourceClass", sql.VarChar(40), saved.sourceClass).query("DECLARE @keys TABLE(id nvarchar(100)); INSERT INTO dbo.merit(m_date,m_time,st_id,merit_sel,merit_code,merit_text,merit_point,t_id,bigo,class,work_date) OUTPUT CONVERT(nvarchar(100),inserted.key_num) INTO @keys VALUES(@date,@time,@sid,'D',@code,@text,@points,@teacher,'',@sourceClass,@date); SELECT id FROM @keys;");
        result = { sourceRecordId: String(inserted.recordset[0].id) };
      } else {
        if (!job.sourceRecordId) throw new ReviewRequired("취소할 원본 기록 ID가 없습니다.");
        const deleted = await tx.request().input("id", sql.VarChar(100), job.sourceRecordId).input("sid", sql.VarChar(100), saved.id).input("tid", sql.VarChar(100), job.payload.teacherSourceId).input("code", sql.VarChar(100), job.payload.item.code).query("DELETE FROM dbo.merit WHERE key_num=@id AND st_id=@sid AND t_id=@tid AND merit_sel='D' AND merit_code=@code");
        if (deleted.rowsAffected[0] !== 1) throw new ReviewRequired("취소 대상이 바뀌었거나 이미 없습니다."); result = { sourceRecordId: job.sourceRecordId, cancelled: true };
      }
      await tx.request().input("id", sql.UniqueIdentifier, job.requestId).input("operation", sql.VarChar(20), job.operation).input("scope", sql.NVarChar(100), this.bridgeConfig.sourceScope).input("hash", sql.Char(64), job.payloadHash).input("record", sql.NVarChar(100), String(result.sourceRecordId ?? "")).input("json", sql.NVarChar(sql.MAX), JSON.stringify(result)).input("audit", sql.NVarChar(sql.MAX), JSON.stringify({ studentId: saved.id, teacherId: job.payload.teacherSourceId, itemKey: job.payload.item.key })).query("INSERT INTO dbo.HguniReceipt(request_id,operation,source_scope,payload_hash,source_record_id,result_json,audit_json) VALUES(@id,@operation,@scope,@hash,NULLIF(@record,''),@json,@audit)");
      await tx.commit(); began = false; return { outcome: "succeeded", result };
    } catch (error) {
      if (began) await tx.rollback().catch(() => undefined);
      if (error instanceof ReviewRequired) return { outcome: cancellation ? "manual_required" : "failed_safe", result: { message: error.message } };
      return { outcome: "uncertain", result: { message: error instanceof Error ? error.message : "SQL 결과를 확인할 수 없습니다." } };
    }
  }
  async close() { await this.pool.close(); }
}
