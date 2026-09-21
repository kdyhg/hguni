export type RequestState =
  | "queued"
  | "executing"
  | "succeeded"
  | "failed_safe"
  | "uncertain"
  | "expired_unsent"
  | "cancel_requested"
  | "cancel_approved"
  | "cancel_succeeded"
  | "cancel_manual_required";

export type Student = {
  id: string;
  name: string;
  grade: number;
  classLabel: string;
  number: number;
  sourceClass: string;
  active: boolean;
};

export type PenaltyItem = {
  key: string;
  kind: "D";
  code: string;
  label: string;
  signedPoints: number;
  enabled: boolean;
};

export type PenaltyRecord = {
  id: string;
  requestId: string;
  student: Student;
  item: PenaltyItem;
  roster: string[];
  state: RequestState;
  createdAt: string;
  message?: string;
  cancellationId?: string;
};

export type CouncilStatus = {
  mode: "mock" | "live";
  activity: { id: string; name: string; startsAt: string; endsAt: string } | null;
  lockReason: "outside_hours" | "bridge_offline" | "teacher_missing" | "catalog_missing" | null;
  session: { unlocked: boolean; roster: string[] };
  bridgeReady: boolean;
};

export type ApiSuccess<T> = { data: T; serverTime: string };
export type ApiFailure = {
  error: { code: string; message: string; requestId?: string };
  serverTime: string;
};
