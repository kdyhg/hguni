import { describe, expect, it } from "vitest";
import { penaltySchema, pinSchema, rosterSchema } from "@/lib/domain/validation";

describe("boundary validation", () => {
  it("accepts only an exact six-digit PIN", () => {
    expect(pinSchema.safeParse({ pin: "123456" }).success).toBe(true);
    expect(pinSchema.safeParse({ pin: "12345a" }).success).toBe(false);
  });
  it("normalizes roster names and rejects duplicates", () => {
    expect(rosterSchema.safeParse({ names: [" 김민수 ", "김민수"] }).success).toBe(false);
    expect(rosterSchema.parse({ names: [" 김민수 "] }).names).toEqual(["김민수"]);
  });
  it("rejects client-supplied points, teacher, and date", () => {
    const base = { requestId: crypto.randomUUID(), studentId: "S-1", itemKey: "D:LATE", catalogVersion: "v1" };
    expect(penaltySchema.safeParse(base).success).toBe(true);
    expect(penaltySchema.safeParse({ ...base, points: 999 }).success).toBe(false);
    expect(penaltySchema.safeParse({ ...base, teacherId: "forged" }).success).toBe(false);
    expect(penaltySchema.safeParse({ ...base, appliedDate: "2020-01-01" }).success).toBe(false);
  });
});
