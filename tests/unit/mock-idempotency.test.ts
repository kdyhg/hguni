import { describe, expect, it } from "vitest";
import { mockStore } from "@/lib/server/mock-store";

describe("mock request idempotency", () => {
  it("returns one request for 100 replays and blocks a second business duplicate", async () => {
    const { token } = await mockStore.unlock("246810", `unit-${crypto.randomUUID()}`);
    await mockStore.setRoster(token, ["테스트 담당"]);
    const input = { requestId: crypto.randomUUID(), studentId: "ST-2026-20312", itemKey: "D:LATE", catalogVersion: "mock-catalog-v1" };
    const records = await Promise.all(Array.from({ length: 100 }, () => mockStore.createPenalty(token, input)));
    expect(new Set(records.map((record) => record.id)).size).toBe(1);
    await expect(mockStore.createPenalty(token, { ...input, requestId: crypto.randomUUID() })).rejects.toThrow("DUPLICATE_PENALTY");
  });
});
