// 일기 규칙: 기분 태그, 타임테이블, 임시저장, 검색, 월간 리포트
export const MAX_MOODS = 5;
export const START_HOUR = 6;
export const END_HOUR = 29; // 마지막 줄 (다음날 05시)
export const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
export const SLOTS_PER_HOUR = 6; // 10분 단위

export const WEATHER = [
  { id: "sunny", name: "맑음" },
  { id: "cloudy", name: "흐림" },
  { id: "rainy", name: "비" },
  { id: "snowy", name: "눈" },
  { id: "windy", name: "바람" },
];

export function addMood(moods, labelId) {
  if (moods.length >= MAX_MOODS || moods.some((m) => m.label_id === labelId)) return moods;
  return [...moods, { label_id: labelId, score: 50 }];
}

export function slotIndex(hour, part) {
  return (hour - START_HOUR) * SLOTS_PER_HOUR + part;
}

export function paintRange(t, from, to, labelId) {
  const next = { ...t };
  const last = HOURS.length * SLOTS_PER_HOUR - 1;
  for (let slot = Math.max(0, Math.min(from, to)); slot <= Math.min(last, Math.max(from, to)); slot++) {
    if (labelId) next[slot] = labelId;
    else delete next[slot];
  }
  return next;
}

/** 라벨별 사용 시간(분) */
export function minutesByLabel(t) {
  const out = {};
  for (const id of Object.values(t)) out[id] = (out[id] ?? 0) + 10;
  return out;
}

export function durationText(minutes) {
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}

export function shortDuration(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return [h ? `${h}시간` : "", m ? `${m}분` : ""].filter(Boolean).join(" ");
}

export function draftKey(userId, day) {
  return `diary-draft:${userId}:${day}`;
}

export function readDraft(raw, savedAt) {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data.updatedAt !== "number" || (savedAt && data.updatedAt <= Date.parse(savedAt))) return null;
    const d = data.fields;
    if (!d || typeof d.title !== "string" || typeof d.content !== "string" || !Array.isArray(d.moods) || !Array.isArray(d.photos) || !d.timetable || typeof d.timetable !== "object") return null;
    return { ...d, weather: WEATHER.some((w) => w.id === d.weather) ? d.weather : null };
  } catch { return null; }
}

export function searchEntries(entries, query, labelId = "", from = "", to = "") {
  const needle = query.trim().toLocaleLowerCase();
  return entries.filter((e) =>
    (!needle || `${e.title}\n${e.content}`.toLocaleLowerCase().includes(needle)) &&
    (!from || e.entry_date >= from) && (!to || e.entry_date <= to) &&
    (!labelId || e.moods.some((m) => m.label_id === labelId) || Object.values(e.timetable).includes(labelId)),
  ).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

export function monthlyReport(entries, month, labels) {
  const days = entries.filter((e) => e.entry_date.startsWith(`${month}-`)).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const moods = labels.filter((l) => l.kind === "mood").map((l) => {
    const values = days.flatMap((e) => e.moods.filter((m) => m.label_id === l.id).map((m) => m.score));
    return { ...l, count: values.length, average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 };
  }).filter((m) => m.count > 0).sort((a, b) => b.count - a.count);
  const activity = labels.filter((l) => l.kind === "activity")
    .map((l) => ({ ...l, minutes: days.reduce((sum, e) => sum + (minutesByLabel(e.timetable)[l.id] ?? 0), 0) }))
    .filter((l) => l.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = activity.reduce((sum, l) => sum + l.minutes, 0);
  const trend = days.map((e) => {
    const point = { day: e.entry_date.slice(8) };
    for (const mood of e.moods) point[mood.label_id] = mood.score;
    return point;
  });
  return { days, moods, activity, totalMinutes, trend };
}

// 날짜는 항상 브라우저 현지 시간의 YYYY-MM-DD로 다룹니다
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDay = (s) => new Date(`${s}T00:00:00`);
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDay(s).getTime());

/** 달력 한 달 칸: 앞뒤 빈칸은 null */
export function monthCells(year, month) {
  const first = new Date(year, month, 1).getDay();
  const count = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= count; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : "#0031B0");

/* ---------- 첫 화면 시계 ---------- */
/** 한국 시간(UTC+9, 서머타임 없음)의 연월일시분초 */
export function kstParts(ms) {
  const d = new Date(ms + 9 * 3600 * 1000);
  return { y: d.getUTCFullYear(), mo: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
}

/** 2026 → ’26 */
export const yearMark = (y) => `’${String(y).slice(-2)}`;

export function clockText(ms) {
  const t = kstParts(ms), p = (n) => String(n).padStart(2, "0");
  return `${t.y}년 ${t.mo}월 ${t.d}일 ${p(t.h)}:${p(t.mi)}:${p(t.s)}`;
}

/** 서버 시각 표본들 중 왕복이 가장 짧은 것으로 기기 시계와의 차이(ms)를 구함 */
export function clockOffset(samples) {
  const ok = samples.filter((x) => Number.isFinite(x.server) && x.received >= x.sent);
  if (!ok.length) return null;
  const best = ok.reduce((a, b) => (b.received - b.sent < a.received - a.sent ? b : a));
  return { offset: best.server - (best.sent + best.received) / 2, error: (best.received - best.sent) / 2 };
}
