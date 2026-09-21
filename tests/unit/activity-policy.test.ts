import { describe, expect, it } from "vitest";
import { isOpenAt, localMinute, schedulesOverlap, validateSchedule } from "@/lib/domain/activity-policy";

const schedule = { name: "아침 등교지도", weekdays: [1], startLocal: "07:40", endLocal: "08:30" };

describe("activity policy", () => {
  it("treats the interval as start-inclusive and end-exclusive", () => {
    expect(isOpenAt(schedule, new Date("2026-09-20T22:39:59.000Z"))).toBe(false);
    expect(isOpenAt(schedule, new Date("2026-09-20T22:40:00.000Z"))).toBe(true);
    expect(isOpenAt(schedule, new Date("2026-09-20T23:30:00.000Z"))).toBe(false);
  });
  it("rejects overnight or zero-length schedules", () => {
    expect(() => validateSchedule({ ...schedule, startLocal: "08:30", endLocal: "08:30" })).toThrow();
    expect(() => validateSchedule({ ...schedule, startLocal: "22:00", endLocal: "07:00" })).toThrow();
  });
  it("detects overlaps only on shared weekdays", () => {
    expect(schedulesOverlap(schedule, { ...schedule, name: "겹침", startLocal: "08:00", endLocal: "09:00" })).toBe(true);
    expect(schedulesOverlap(schedule, { ...schedule, weekdays: [2], startLocal: "08:00", endLocal: "09:00" })).toBe(false);
    expect(localMinute("07:40")).toBe(460);
  });
});
