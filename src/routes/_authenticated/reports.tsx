import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Input } from "@/components/ui/input";
import { DiaryNav } from "@/components/diary/DiaryNav";
import { useLabels } from "@/components/diary/LabelManager";
import { diaryEntriesOptions } from "@/lib/diary-queries";
import { durationText, monthlyReport } from "@/lib/diary";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "월간 리포트 — 일기장" }, { name: "description", content: "한 달의 감정 변화와 활동 시간을 돌아보세요" }, { property: "og:title", content: "월간 리포트 — 일기장" }, { property: "og:description", content: "한 달의 감정 변화와 활동 시간을 돌아보세요" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(diaryEntriesOptions(context.user.id)),
  component: ReportsPage,
});
function ReportsPage() {
  const { user } = Route.useRouteContext();
  const { data: entries } = useSuspenseQuery(diaryEntriesOptions(user.id));
  const { data: labels = [] } = useLabels();
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const report = monthlyReport(entries, month, labels);
  return <main className="mx-auto max-w-5xl px-4 py-10"><div className="mb-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-3xl font-bold">월간 리포트</h1><Input type="month" aria-label="리포트 월" className="w-44" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></div><DiaryNav /><div className="mb-10 grid grid-cols-2 gap-6 border-b pb-8"><div><p className="text-sm text-muted-foreground">기록한 날</p><p className="mt-2 text-3xl font-bold">{report.days.length}<span className="ml-1 text-base font-normal">일</span></p></div><div><p className="text-sm text-muted-foreground">총 활동 시간</p><p className="mt-2 text-2xl font-bold">{durationText(report.totalMinutes)}</p></div></div>
    <section><h2 className="text-xl font-bold">감정 리포트</h2>{!report.moods.length ? <p className="py-12 text-center text-muted-foreground">이 달의 기분 기록이 없어요.</p> : <><div className="mt-6 h-72 w-full" aria-label="일별 기분 점수 그래프"><ResponsiveContainer width="100%" height="100%"><LineChart data={report.trend} margin={{ left: -20, right: 15, top: 10, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="day" stroke="var(--muted-foreground)" tickLine={false} /><YAxis domain={[0, 100]} stroke="var(--muted-foreground)" tickLine={false} /><Tooltip contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", color: "var(--popover-foreground)" }} />{report.moods.map((m) => <Line key={m.id} dataKey={m.id} name={m.name} stroke={m.color} strokeWidth={2} connectNulls={false} dot={{ r: 4 }} isAnimationActive={false} />)}</LineChart></ResponsiveContainer></div><ul className="mt-6 divide-y">{report.moods.map((m) => <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="flex items-center gap-2"><span className="size-3 rounded-sm" style={{ backgroundColor: m.color }} />{m.name}</span><span className="text-muted-foreground">{m.count}일 · 평균 {m.average}점</span></li>)}</ul></>}</section>
    <section className="mt-12 border-t pt-8"><h2 className="text-xl font-bold">활동 통계</h2>{!report.activity.length ? <p className="py-12 text-center text-muted-foreground">이 달의 활동 기록이 없어요.</p> : <ul className="mt-6 space-y-5">{report.activity.map((a) => <li key={a.id}><div className="mb-2 flex flex-wrap justify-between gap-2 text-sm"><span className="font-medium">{a.name}</span><span className="text-muted-foreground">{durationText(a.minutes)} · {Math.round(a.minutes / report.totalMinutes * 100)}%</span></div><div className="h-3 overflow-hidden rounded-sm bg-muted"><div className="h-full rounded-sm" style={{ width: `${a.minutes / report.totalMinutes * 100}%`, backgroundColor: a.color }} /></div></li>)}</ul>}</section>
  </main>;
}