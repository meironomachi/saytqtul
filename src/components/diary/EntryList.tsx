import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WeatherPicker } from "@/components/diary/WeatherPicker";
import { durationText, minutesByLabel, type DiaryRecord, type Label } from "@/lib/diary";

export function EntryList({ entries, labels }: { entries: DiaryRecord[]; labels: Label[] }) {
  const byId = new Map(labels.map((l) => [l.id, l]));
  if (!entries.length) return <p className="py-16 text-center text-muted-foreground">일기가 없어요.</p>;
  return <ol className="divide-y">{entries.map((e) => <li key={e.id} className="py-6">
    <div className="flex items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-3"><time className="text-sm text-muted-foreground">{e.entry_date.replaceAll("-", ".")}</time><WeatherPicker value={e.weather} readOnly /></div><Button asChild variant="ghost" size="icon" title="일기 열기"><Link to="/calendar" search={{ date: e.entry_date }} aria-label={`${e.entry_date} 일기 열기`}><ArrowUpRight className="size-4" /></Link></Button></div>
    <Link to="/calendar" search={{ date: e.entry_date }} className="text-xl font-bold hover:text-primary">{e.title || "제목 없음"}</Link>
    <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{e.content}</p>
    <div className="mt-3 flex flex-wrap gap-3 text-xs">{e.moods.map((m) => { const l = byId.get(m.label_id); return l ? <span key={l.id} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ backgroundColor: l.color }} />{l.name} {m.score}</span> : null; })}{Object.keys(e.timetable).length > 0 && <span className="text-muted-foreground">활동 {durationText(Object.values(minutesByLabel(e.timetable)).reduce((a,b) => a+b,0))}</span>}</div>
  </li>)}</ol>;
}