import type { RequestState } from "./contracts";

export const terminalStates: ReadonlySet<RequestState> = new Set([
  "succeeded",
  "failed_safe",
  "uncertain",
  "expired_unsent",
  "cancel_succeeded",
  "cancel_manual_required",
]);

const transitions: Record<RequestState, readonly RequestState[]> = {
  queued: ["executing", "expired_unsent", "cancel_requested", "failed_safe"],
  executing: ["succeeded", "failed_safe", "uncertain", "cancel_requested"],
  succeeded: ["cancel_requested"],
  failed_safe: ["queued", "cancel_requested"],
  uncertain: ["succeeded", "failed_safe", "cancel_requested"],
  expired_unsent: ["cancel_succeeded"],
  cancel_requested: ["queued", "executing", "succeeded", "cancel_approved"],
  cancel_approved: ["cancel_succeeded", "cancel_manual_required", "uncertain"],
  cancel_succeeded: [],
  cancel_manual_required: ["cancel_succeeded"],
};

export function canTransition(from: RequestState, to: RequestState) {
  return from === to || transitions[from].includes(to);
}

export function assertTransition(from: RequestState, to: RequestState) {
  if (!canTransition(from, to)) throw new Error(`Invalid request transition: ${from} -> ${to}`);
}

export const stateLabel: Record<RequestState, string> = {
  queued: "전송 중",
  executing: "전송 중",
  succeeded: "반영 완료",
  failed_safe: "반영되지 않음",
  uncertain: "확인 필요",
  expired_unsent: "시간이 지나 전송되지 않음",
  cancel_requested: "취소 승인 대기",
  cancel_approved: "취소 확인 중",
  cancel_succeeded: "취소 완료",
  cancel_manual_required: "교사 직접 처리 필요",
};
