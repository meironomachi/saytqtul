import { describe, it, expect } from "vitest";
import { addMood, HOURS, minutesByLabel, slotIndex } from "@/lib/diary";

describe("diary rules", () => {
  it("allows at most 5 mood tags", () => {
    let m = [] as ReturnType<typeof addMood>;
    for (const id of ["a", "b", "c", "d", "e", "f"]) m = addMood(m, id);
    expect(m.length).toBe(5);
  });
  it("timetable runs 06 to 29 in 10-minute slots", () => {
    expect(HOURS[0]).toBe(6);
    expect(HOURS[HOURS.length - 1]).toBe(29);
    expect(slotIndex(29, 5)).toBe(143);
  });
  it("counts 10 minutes per slot", () => {
    expect(minutesByLabel({ 0: "x", 1: "x", 7: "y" })).toEqual({ x: 20, y: 10 });
  });
});
