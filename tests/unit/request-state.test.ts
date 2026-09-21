import { describe, expect, it } from "vitest";
import { assertTransition, canTransition } from "@/lib/domain/request-state";

describe("request state transitions", () => {
  it("never lets a late failure overwrite success", () => {
    expect(canTransition("succeeded", "failed_safe")).toBe(false);
    expect(() => assertTransition("succeeded", "failed_safe")).toThrow("Invalid request transition");
  });
  it("allows reconciliation from uncertain to success", () => {
    expect(canTransition("uncertain", "succeeded")).toBe(true);
  });
  it("keeps cancellation approval separate from completion", () => {
    expect(canTransition("cancel_requested", "cancel_approved")).toBe(true);
    expect(canTransition("cancel_approved", "cancel_succeeded")).toBe(true);
  });
});
