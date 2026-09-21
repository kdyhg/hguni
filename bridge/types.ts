import type { PenaltyItem, Student } from "@/lib/domain/contracts";

export type SourceTeacher = { id: string; name: string; active: boolean };
export type Catalog = { students: Student[]; items: PenaltyItem[]; teachers: SourceTeacher[] };
export type BridgeJob = {
  jobId: string;
  operation: "penalty" | "cancel";
  requestId: string;
  leaseGeneration: number;
  leaseUntil: string;
  executeBefore: string;
  payloadHash: string;
  sourceRecordId?: string | null;
  payload: {
    student: Student;
    item: PenaltyItem;
    roster: string[];
    teacherSourceId: string;
    sourceScope: string;
  };
};
export type BridgeOutcome = { outcome: "succeeded" | "failed_safe" | "uncertain" | "manual_required"; result: Record<string, unknown> };
export type Receipt = { requestId: string; operation: string; sourceScope: string; payloadHash: string; sourceRecordId: string | null; result: Record<string, unknown> };

export interface BridgeAdapter {
  health(): Promise<{ sqlReady: boolean; penalty: boolean; cancellation: boolean; sourceScope: string }>;
  listCatalog(): Promise<Catalog>;
  lookupReceipt(requestId: string): Promise<Receipt | null>;
  applyPenalty(job: BridgeJob): Promise<BridgeOutcome>;
  cancelPenalty(job: BridgeJob): Promise<BridgeOutcome>;
  close(): Promise<void>;
}
