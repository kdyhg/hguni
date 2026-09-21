import { fail } from "./http";

const errors: Record<string, [string, number, string]> = {
  SESSION_INVALID: ["SESSION_INVALID", 401, "활동 세션이 끝났습니다. 교사가 다시 열어 주세요."],
  PIN_INVALID: ["PIN_INVALID", 401, "PIN을 확인하고 다시 시도하세요."],
  PIN_RATE_LIMITED: ["PIN_RATE_LIMITED", 429, "잠시 후 다시 시도하세요."],
  PIN_NOT_CONFIGURED: ["PIN_NOT_CONFIGURED", 503, "활동 PIN이 준비되지 않았습니다."],
  ROSTER_REQUIRED: ["ROSTER_REQUIRED", 409, "오늘 활동하는 담당자를 먼저 등록하세요."],
  CATALOG_STALE: ["CATALOG_STALE", 409, "학생 또는 항목 정보가 바뀌었습니다. 다시 검색하세요."],
  DUPLICATE_PENALTY: ["DUPLICATE_PENALTY", 409, "이 활동에서 같은 학생에게 같은 항목을 이미 부과했습니다."],
  NOT_FOUND: ["NOT_FOUND", 404, "내역을 찾을 수 없습니다."],
  CANCELLATION_INVALID: ["CANCELLATION_INVALID", 409, "현재 상태에서는 취소를 요청하거나 처리할 수 없습니다."],
};

export function storeError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const match = Object.entries(errors).find(([key]) => message.includes(key));
  if (match) {
    const [code, status, userMessage] = match[1];
    const response = fail(code, userMessage, status);
    if (status === 429) response.headers.set("Retry-After", "300");
    return response;
  }
  return null;
}
