import { afterEach, describe, expect, it } from "vitest";
import { env } from "@/lib/server/env";

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });

describe("environment safety", () => {
  it("rejects mock data in production", () => {
    process.env.APP_ENV = "production"; process.env.USE_MOCK_DATA = "true";
    expect(() => env()).toThrow("운영 환경에서는 mock 데이터를 사용할 수 없습니다");
  });
  it("rejects real writes outside production", () => {
    process.env.APP_ENV = "preview"; process.env.USE_MOCK_DATA = "false"; process.env.REAL_WRITES_ENABLED = "true";
    expect(() => env()).toThrow("실제 쓰기는 production 환경에서만");
  });
});
