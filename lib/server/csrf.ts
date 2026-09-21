export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) throw new Error("요청 출처를 확인할 수 없습니다.");
  const url = new URL(origin);
  if (url.host !== host) throw new Error("허용되지 않은 요청 출처입니다.");
}
