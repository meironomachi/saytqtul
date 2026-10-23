// 실행: node --test test/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { addMood, HOURS, minutesByLabel, slotIndex, paintRange, monthlyReport, searchEntries, readDraft, draftKey, WEATHER, monthCells, ymd, isDay, safeColor } from "../js/diary.js";

test("기분 태그는 최대 5개", () => {
  let m = [];
  for (const id of ["a", "b", "c", "d", "e", "f"]) m = addMood(m, id);
  assert.equal(m.length, 5);
});

test("타임테이블은 06~29시, 10분 단위", () => {
  assert.equal(HOURS[0], 6);
  assert.equal(HOURS.at(-1), 29);
  assert.equal(slotIndex(29, 5), 143);
  assert.deepEqual(minutesByLabel({ 0: "x", 1: "x", 7: "y" }), { x: 20, y: 10 });
});

const entries = [
  { id: "1", entry_date: "2026-10-22", title: "산책", content: "공원에서 행복한 하루", moods: [{ label_id: "happy", score: 80 }], timetable: { 0: "walk", 1: "walk" }, photos: [], weather: "sunny" },
  { id: "2", entry_date: "2026-10-23", title: "독서", content: "책을 읽었다", moods: [{ label_id: "happy", score: 40 }], timetable: { 5: "walk" }, photos: [], weather: null },
  { id: "3", entry_date: "2026-11-01", title: "다음 달", content: "공원", moods: [], timetable: {}, photos: [], weather: null },
];

test("월간 리포트는 고른 달만 계산", () => {
  const r = monthlyReport(entries, "2026-10", [{ id: "happy", kind: "mood", name: "행복", color: "blue" }, { id: "walk", kind: "activity", name: "산책", color: "green" }]);
  assert.equal(r.days.length, 2);
  assert.deepEqual([r.moods[0].count, r.moods[0].average], [2, 60]);
  assert.deepEqual(r.trend[0], { day: "22", happy: 80 });
  assert.equal(r.totalMinutes, 30);
});

test("검색은 글자, 태그, 날짜를 함께 거르고 최신순", () => {
  assert.deepEqual(searchEntries(entries, "공원", "happy", "2026-10-22", "2026-10-22").map((e) => e.id), ["1"]);
  assert.deepEqual(searchEntries(entries, "", "walk").map((e) => e.id), ["2", "1"]);
  assert.deepEqual(searchEntries(entries, "").map((e) => e.id), ["3", "2", "1"]);
});

test("날씨 값", () => {
  assert.deepEqual(WEATHER.map((w) => w.id), ["sunny", "cloudy", "rainy", "snowy", "windy"]);
});

test("임시저장은 사용자·날짜별이고 더 새 저장본을 덮지 않음", () => {
  assert.notEqual(draftKey("a", "2026-10-23"), draftKey("b", "2026-10-23"));
  const raw = JSON.stringify({ updatedAt: Date.parse("2026-10-23T04:00:00Z"), fields: entries[0] });
  assert.equal(readDraft(raw, "2026-10-23T03:00:00Z")?.content, "공원에서 행복한 하루");
  assert.equal(readDraft(raw, "2026-10-23T05:00:00Z"), null);
});

test("드래그는 건너뛴 칸까지 칠하고 지움", () => {
  assert.deepEqual(paintRange({}, 5, 2, "walk"), { 2: "walk", 3: "walk", 4: "walk", 5: "walk" });
  assert.deepEqual(paintRange({ 1: "walk", 2: "walk", 3: "walk" }, 2, 3, null), { 1: "walk" });
});

test("달력 칸과 날짜 도우미", () => {
  const cells = monthCells(2026, 9); // 2026년 10월: 목요일 시작
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.slice(0, 4).every((c) => c === null), true);
  assert.equal(ymd(cells[4]), "2026-10-01");
  assert.equal(isDay("2026-10-23"), true);
  assert.equal(isDay("2026-13-99"), false);
  assert.equal(safeColor("red;x"), "#0031B0");
});

test("첫 화면 시계: 한국 시간, 연도 표시, 서버 시각 보정", async () => {
  const { kstParts, yearMark, clockText, clockOffset } = await import("../js/diary.js");
  // 2026-12-31 15:00:05 UTC = 2027-01-01 00:00:05 KST
  const ms = Date.UTC(2026, 11, 31, 15, 0, 5);
  assert.deepEqual(kstParts(ms), { y: 2027, mo: 1, d: 1, h: 0, mi: 0, s: 5 });
  assert.equal(yearMark(2026), "’26");
  assert.equal(yearMark(2027), "’27");
  assert.equal(clockText(ms), "2027년 1월 1일 00:00:05");
  const r = clockOffset([
    { sent: 1000, received: 1400, server: 6000 },
    { sent: 2000, received: 2100, server: 7300 }, // 왕복이 가장 짧음 → 중간 2050 기준 +5250
    { sent: 3000, received: 2900, server: 1 }, // 잘못된 표본은 버림
  ]);
  assert.deepEqual(r, { offset: 5250, error: 50 });
  assert.equal(clockOffset([]), null);
});
