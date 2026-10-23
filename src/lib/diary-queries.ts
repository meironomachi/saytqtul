import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DiaryRecord, Mood, Timetable, Weather } from "@/lib/diary";

export function diaryEntriesOptions(userId: string) {
  return queryOptions({
    queryKey: ["diary-entries", userId],
    queryFn: async (): Promise<DiaryRecord[]> => {
      const { data, error } = await supabase.from("entries").select("id, entry_date, title, content, moods, timetable, photos, weather").eq("user_id", userId).order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((e) => ({ ...e, moods: e.moods as Mood[], timetable: e.timetable as Timetable, weather: e.weather as Weather | null }));
    },
  });
}