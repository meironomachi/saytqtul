import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DiaryNav } from "@/components/diary/DiaryNav";
import { EntryList } from "@/components/diary/EntryList";
import { useLabels } from "@/components/diary/LabelManager";
import { diaryEntriesOptions } from "@/lib/diary-queries";

export const Route = createFileRoute("/_authenticated/timeline")({
  head: () => ({ meta: [{ title: "타임라인 — 일기장" }, { name: "description", content: "날짜순으로 돌아보는 나의 일기" }, { property: "og:title", content: "타임라인 — 일기장" }, { property: "og:description", content: "날짜순으로 돌아보는 나의 일기" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(diaryEntriesOptions(context.user.id)),
  component: TimelinePage,
});
function TimelinePage() {
  const { user } = Route.useRouteContext();
  const { data: entries } = useSuspenseQuery(diaryEntriesOptions(user.id));
  const { data: labels = [] } = useLabels();
  const months = [...new Set(entries.map((e) => e.entry_date.slice(0, 7)))];
  return <main className="mx-auto max-w-4xl px-4 py-10"><h1 className="mb-6 text-3xl font-bold">타임라인</h1><DiaryNav />{!months.length && <EntryList entries={[]} labels={labels} />}{months.map((month) => <section key={month} className="mb-10"><h2 className="border-b pb-3 text-lg font-bold text-primary">{month.replace("-", "년 ")}월</h2><EntryList entries={entries.filter((e) => e.entry_date.startsWith(month))} labels={labels} /></section>)}</main>;
}