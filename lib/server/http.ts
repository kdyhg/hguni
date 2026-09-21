import { NextResponse } from "next/server";
import type { ApiFailure, ApiSuccess } from "@/lib/domain/contracts";

const noStore = { "Cache-Control": "no-store, private", "X-Robots-Tag": "noindex" };

export function ok<T>(data: T, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data, serverTime: new Date().toISOString() }, { status, headers: noStore });
}

export function fail(code: string, message: string, status = 400, requestId?: string) {
  return NextResponse.json<ApiFailure>(
    { error: { code, message, ...(requestId ? { requestId } : {}) }, serverTime: new Date().toISOString() },
    { status, headers: noStore },
  );
}

export function routeError(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") return fail("INVALID_INPUT", "입력값을 다시 확인하세요.", 422);
  if (error instanceof Error && error.message.includes("JSON")) return fail("INVALID_CONTENT_TYPE", error.message, 415);
  console.error("route_error", error instanceof Error ? error.message : "unknown");
  return fail("INTERNAL_ERROR", "요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.", 500);
}
