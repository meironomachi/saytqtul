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
