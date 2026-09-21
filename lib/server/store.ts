import { cookies } from "next/headers";
import type { CouncilStatus, PenaltyItem, PenaltyRecord, Student } from "@/lib/domain/contracts";
import { isMockMode } from "./env";
import { liveStore } from "./live-store";
import { mockStore } from "./mock-store";

export const COUNCIL_COOKIE = "hguni_council_session";
export const TEACHER_COOKIE = "hguni_teacher_session";

export type PenaltyInput = { requestId: string; studentId: string; itemKey: string; catalogVersion: string };

export interface AppStore {
  status(token?: string): Promise<CouncilStatus>;
  unlock(pin: string, clientKey: string): Promise<{ token: string; expiresAt: string }>;
  setRoster(token: string, names: string[]): Promise<string[]>;
  students(token: string, query: string): Promise<Student[]>;
  items(token: string): Promise<{ version: string; items: PenaltyItem[] }>;
  createPenalty(token: string, input: PenaltyInput): Promise<PenaltyRecord>;
  penalty(token: string, requestId: string): Promise<PenaltyRecord>;
  history(token: string): Promise<PenaltyRecord[]>;
  requestCancellation(token: string, requestId: string, reason: string): Promise<PenaltyRecord>;
  end(token: string): Promise<void>;
  teacherHistory(): Promise<PenaltyRecord[]>;
  approveCancellation(requestId: string, reason: string, actorId?: string): Promise<PenaltyRecord>;
  rejectCancellation(requestId: string, reason: string, actorId?: string): Promise<PenaltyRecord>;
}

export function store(): AppStore {
  return isMockMode() ? mockStore : liveStore;
}

export async function councilToken() {
  return (await cookies()).get(COUNCIL_COOKIE)?.value;
}
