import type { BridgeAdapter, BridgeJob, BridgeOutcome, Catalog, Receipt } from "./types";

const receipts = new Map<string, Receipt>();
export class MockAdapter implements BridgeAdapter {
  constructor(private readonly sourceScope: string) {}
  async health() { return { sqlReady: true, penalty: true, cancellation: true, sourceScope: this.sourceScope }; }
  async listCatalog(): Promise<Catalog> { return { students: [], items: [], teachers: [] }; }
  async lookupReceipt(requestId: string) { return receipts.get(requestId) ?? null; }
  async applyPenalty(job: BridgeJob): Promise<BridgeOutcome> { const previous = receipts.get(job.requestId); if (previous) return { outcome: "succeeded", result: previous.result }; const result = { sourceRecordId: `MOCK-${job.requestId.slice(0,8)}` }; receipts.set(job.requestId, { requestId: job.requestId, operation: "penalty", sourceScope: this.sourceScope, payloadHash: job.payloadHash, sourceRecordId: String(result.sourceRecordId), result }); return { outcome: "succeeded", result }; }
  async cancelPenalty(job: BridgeJob): Promise<BridgeOutcome> { const result = { sourceRecordId: job.sourceRecordId, cancelled: true }; receipts.set(job.requestId, { requestId: job.requestId, operation: "cancel", sourceScope: this.sourceScope, payloadHash: job.payloadHash, sourceRecordId: job.sourceRecordId ?? null, result }); return { outcome: "succeeded", result }; }
  async close() {}
}
