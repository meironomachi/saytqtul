export const MAX_MOODS = 5;
export const START_HOUR = 6;
export const END_HOUR = 29; // 마지막 줄 (다음날 05시)
export const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
export const SLOTS_PER_HOUR = 6; // 10분 단위

export type Mood = { label_id: string; score: number };
export type Timetable = Record<string, string>; // slot index -> label id
export type Label = { id: string; kind: string; name: string; color: string };

export function addMood(moods: Mood[], labelId: string): Mood[] {
  if (moods.length >= MAX_MOODS || moods.some((m) => m.label_id === labelId)) return moods;
  return [...moods, { label_id: labelId, score: 50 }];
}

export function slotIndex(hour: number, part: number) {
  return (hour - START_HOUR) * SLOTS_PER_HOUR + part;
}

export function paintSlot(t: Timetable, slot: number, labelId: string | null): Timetable {
  const next = { ...t };
  if (labelId) next[slot] = labelId;
  else delete next[slot];
  return next;
}

/** 라벨별 사용 시간(분) */
export function minutesByLabel(t: Timetable): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of Object.values(t)) out[id] = (out[id] ?? 0) + 10;
  return out;
}

export const WEATHER = [
  { id: "sunny", name: "맑음" },
  { id: "cloudy", name: "흐림" },
  { id: "rainy", name: "비" },
  { id: "snowy", name: "눈" },
  { id: "windy", name: "바람" },
] as const;
export type Weather = typeof WEATHER[number]["id"];
export type EntryDraft = { title: string; content: string; moods: Mood[]; timetable: Timetable; photos: string[]; weather: Weather | null };
export type DiaryRecord = EntryDraft & { id: string; entry_date: string };

export function draftKey(userId: string, day: string) {
  return `diary-draft:${userId}:${day}`;
}

export function readDraft(raw: string | null, savedAt?: string): EntryDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (typeof data.updatedAt !== "number" || (savedAt && data.updatedAt <= Date.parse(savedAt))) return null;
    const d = data.fields;
    if (!d || typeof d.title !== "string" || typeof d.content !== "string" || !Array.isArray(d.moods) || !Array.isArray(d.photos) || !d.timetable || typeof d.timetable !== "object") return null;
    return { ...d, weather: WEATHER.some((w) => w.id === d.weather) ? d.weather : null };
  } catch { return null; }
}

export function searchEntries(entries: DiaryRecord[], query: string, labelId = "", from = "", to = "") {
  const needle = query.trim().toLocaleLowerCase();
  return entries.filter((e) =>
    (!needle || `${e.title}\n${e.content}`.toLocaleLowerCase().includes(needle)) &&
    (!from || e.entry_date >= from) && (!to || e.entry_date <= to) &&
    (!labelId || e.moods.some((m) => m.label_id === labelId) || Object.values(e.timetable).includes(labelId)),
  ).sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

export function monthlyReport(entries: DiaryRecord[], month: string, labels: Label[]) {
  const days = entries.filter((e) => e.entry_date.startsWith(`${month}-`)).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
  const moodLabels = labels.filter((l) => l.kind === "mood");
  const activityLabels = labels.filter((l) => l.kind === "activity");
  const moods = moodLabels.map((l) => {
    const values = days.flatMap((e) => e.moods.filter((m) => m.label_id === l.id).map((m) => m.score));
    return { ...l, count: values.length, average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 };
  }).filter((m) => m.count > 0).sort((a, b) => b.count - a.count);
  const activity = activityLabels.map((l) => ({ ...l, minutes: days.reduce((sum, e) => sum + (minutesByLabel(e.timetable)[l.id] ?? 0), 0) })).filter((l) => l.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = activity.reduce((sum, l) => sum + l.minutes, 0);
  const trend = days.map((e) => {
    const point: Record<string, string | number> = { day: e.entry_date.slice(8) };
    for (const mood of e.moods) point[mood.label_id] = mood.score;
    return point;
  });
  return { days, moods, activity, totalMinutes, trend };
}

export function paintRange(t: Timetable, from: number, to: number, labelId: string | null): Timetable {
  const next = { ...t };
  for (let slot = Math.max(0, Math.min(from, to)); slot <= Math.min(HOURS.length * SLOTS_PER_HOUR - 1, Math.max(from, to)); slot++) {
    if (labelId) next[slot] = labelId;
    else delete next[slot];
  }
  return next;
}

export function durationText(minutes: number) {
  return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
}
