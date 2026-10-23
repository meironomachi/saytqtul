import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DiaryNav } from "@/components/diary/DiaryNav";
import { EntryList } from "@/components/diary/EntryList";
import { useLabels } from "@/components/diary/LabelManager";
import { diaryEntriesOptions } from "@/lib/diary-queries";
import { searchEntries } from "@/lib/diary";

export const Route = createFileRoute("/_authenticated/search")({
  head: () => ({ meta: [{ title: "검색 — 일기장" }, { name: "description", content: "제목, 내용, 날짜와 태그로 찾는 나의 일기" }, { property: "og:title", content: "검색 — 일기장" }, { property: "og:description", content: "제목, 내용, 날짜와 태그로 찾는 나의 일기" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(diaryEntriesOptions(context.user.id)),
  component: SearchPage,
});
function SearchPage() {
  const { user } = Route.useRouteContext();
  const { data: entries } = useSuspenseQuery(diaryEntriesOptions(user.id));
  const { data: labels = [] } = useLabels();
  const [query, setQuery] = useState(""); const [label, setLabel] = useState("all"); const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const found = searchEntries(entries, query, label === "all" ? "" : label, from, to);
  return <main className="mx-auto max-w-4xl px-4 py-10"><h1 className="mb-6 text-3xl font-bold">검색</h1><DiaryNav /><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-10" aria-label="일기 검색" placeholder="제목 또는 내용 검색" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-xs text-muted-foreground">시작일<Input type="date" aria-label="검색 시작일" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="space-y-1 text-xs text-muted-foreground">종료일<Input type="date" aria-label="검색 종료일" value={to} onChange={(e) => setTo(e.target.value)} /></label><div className="space-y-1"><p className="text-xs text-muted-foreground">태그</p><Select value={label} onValueChange={setLabel}><SelectTrigger className="w-full" aria-label="검색 태그"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">모든 태그</SelectItem>{labels.map((l) => <SelectItem key={l.id} value={l.id}>{l.kind === "mood" ? "기분" : "활동"} · {l.name}</SelectItem>)}</SelectContent></Select></div></div><p className="mt-6 text-sm text-muted-foreground">검색 결과 {found.length}개</p><EntryList entries={found} labels={labels} /></main>;
}