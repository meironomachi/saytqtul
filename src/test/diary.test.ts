import { describe, it, expect } from "vitest";
import { addMood, HOURS, minutesByLabel, slotIndex, paintRange, monthlyReport, searchEntries, readDraft, draftKey, WEATHER, type DiaryRecord } from "@/lib/diary";

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

const entries: DiaryRecord[] = [
  { id: "1", entry_date: "2026-10-22", title: "산책", content: "공원에서 행복한 하루", moods: [{ label_id: "happy", score: 80 }], timetable: { 0: "walk", 1: "walk" }, photos: [], weather: "sunny" },
  { id: "2", entry_date: "2026-10-23", title: "독서", content: "책을 읽었다", moods: [{ label_id: "happy", score: 40 }], timetable: { 5: "walk" }, photos: [], weather: null },
  { id: "3", entry_date: "2026-11-01", title: "다음 달", content: "공원", moods: [], timetable: {}, photos: [], weather: null },
];

describe("diary additions", () => {
  it("monthly moods average scores only within the chosen month", () => {
    const r = monthlyReport(entries, "2026-10", [{ id: "happy", kind: "mood", name: "행복", color: "blue" }]);
    expect(r.days.length).toBe(2);
    expect(r.moods[0]).toMatchObject({ count: 2, average: 60 });
    expect(r.trend[0]).toEqual({ day: "22", happy: 80 });
  });
  it("activity statistics total ten-minute slots separately from moods", () => {
    const r = monthlyReport(entries, "2026-10", [{ id: "walk", kind: "activity", name: "산책", color: "green" }]);
    expect(r.totalMinutes).toBe(30);
    expect(r.activity[0]?.minutes).toBe(30);
    expect(r.moods).toEqual([]);
  });
  it("search combines text, tag and inclusive date filters", () => {
    expect(searchEntries(entries, "공원", "happy", "2026-10-22", "2026-10-22").map((e) => e.id)).toEqual(["1"]);
    expect(searchEntries(entries, "", "walk").map((e) => e.id)).toEqual(["2", "1"]);
  });
  it("timeline sorts newest dates first", () => {
    expect(searchEntries(entries, "").map((e) => e.id)).toEqual(["3", "2", "1"]);
  });
  it("weather offers distinct selectable values", () => {
    expect(WEATHER.map((w) => w.id)).toEqual(["sunny", "cloudy", "rainy", "snowy", "windy"]);
  });
  it("drafts are isolated by user and date and do not supersede newer saved entries", () => {
    expect(draftKey("a", "2026-10-23")).not.toBe(draftKey("b", "2026-10-23"));
    expect(draftKey("a", "2026-10-23")).not.toBe(draftKey("a", "2026-10-24"));
    const raw = JSON.stringify({ updatedAt: Date.parse("2026-10-23T04:00:00Z"), fields: entries[0] });
    expect(readDraft(raw, "2026-10-23T03:00:00Z")?.content).toBe("공원에서 행복한 하루");
    expect(readDraft(raw, "2026-10-23T05:00:00Z")).toBeNull();
  });
  it("drag paints all skipped slots forward or backward and erases them", () => {
    expect(paintRange({}, 2, 5, "walk")).toEqual({ 2: "walk", 3: "walk", 4: "walk", 5: "walk" });
    expect(paintRange({}, 5, 2, "walk")).toEqual({ 2: "walk", 3: "walk", 4: "walk", 5: "walk" });
    expect(paintRange({ 1: "walk", 2: "walk", 3: "walk" }, 2, 3, null)).toEqual({ 1: "walk" });
  });
});
