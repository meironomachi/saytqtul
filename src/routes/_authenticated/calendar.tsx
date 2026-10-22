import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "달력 — 일기장" },
      { name: "description", content: "날짜를 골라 일기를 쓰고 읽어요" },
      { property: "og:title", content: "달력 — 일기장" },
      { property: "og:description", content: "날짜를 골라 일기를 쓰고 읽어요" },
    ],
  }),
  component: CalendarPage,
});

const ymd = (d: Date) => format(d, "yyyy-MM-dd");

function CalendarPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Date>(new Date());

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("nickname, approved").eq("id", user.id).maybeSingle()).data,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      return (data ?? []).length > 0;
    },
  });

  const { data: dates = [] } = useQuery({
    queryKey: ["entry-dates"],
    queryFn: async () => {
      const { data } = await supabase.from("entries").select("entry_date");
      return (data ?? []).map((r) => new Date(r.entry_date + "T00:00:00"));
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">일기장</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{profile?.nickname || user.email}</span>
          {isAdmin && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin">가입 승인</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            로그아웃
          </Button>
        </div>
      </header>
      {profile && !profile.approved ? (
        <div className="paper p-10 text-center">
          <h2 className="text-xl font-bold">승인을 기다리고 있어요</h2>
          <p className="mt-2 text-muted-foreground">관리자가 가입을 승인하면 일기를 쓸 수 있어요.</p>
        </div>
      ) : (
      <div className="grid gap-6 md:grid-cols-[auto_1fr]">
        <div className="paper h-fit p-2">
          <Calendar
            mode="single"
            locale={ko}
            selected={selected}
            onSelect={(d) => d && setSelected(d)}
            modifiers={{ written: dates }}
            modifiersClassNames={{ written: "[&_button]:underline [&_button]:decoration-primary [&_button]:decoration-2 [&_button]:underline-offset-4 [&_button]:font-bold" }}
            className="bg-transparent [--cell-size:2.6rem]"
          />
          <p className="px-3 pb-2 text-xs text-muted-foreground">밑줄 친 날은 일기를 쓴 날이에요</p>
        </div>
        <EntryPanel key={ymd(selected)} date={selected} userId={user.id} nickname={profile?.nickname} />
      </div>
      )}
    </main>
  );
}

function EntryPanel({ date, userId, nickname }: { date: Date; userId: string; nickname?: string | undefined }) {
  const qc = useQueryClient();
  const day = ymd(date);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [comment, setComment] = useState("");

  const { data: entry, isLoading } = useQuery({
    queryKey: ["entry", day],
    queryFn: async () =>
      (await supabase.from("entries").select("*").eq("entry_date", day).maybeSingle()).data,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", entry?.id],
    enabled: !!entry,
    queryFn: async () =>
      (await supabase.from("comments").select("*").eq("entry_id", entry!.id).order("created_at")).data ?? [],
  });

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
    }
    if (!isLoading && !entry) setEditing(true);
  }, [entry, isLoading]);

  async function save() {
    if (!content.trim()) {
      toast.error("내용을 적어 주세요.");
      return;
    }
    const res = entry
      ? await supabase.from("entries").update({ title, content, updated_at: new Date().toISOString() }).eq("id", entry.id)
      : await supabase.from("entries").insert({ entry_date: day, title, content, user_id: userId });
    if (res.error) {
      toast.error("저장하지 못했어요.");
      return;
    }
    toast.success("저장했어요");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["entry", day] });
    qc.invalidateQueries({ queryKey: ["entry-dates"] });
  }

  async function addComment() {
    if (!comment.trim() || !entry) return;
    const { error } = await supabase.from("comments").insert({ entry_id: entry.id, content: comment, user_id: userId });
    if (error) {
      toast.error("댓글을 달지 못했어요.");
      return;
    }
    setComment("");
    qc.invalidateQueries({ queryKey: ["comments", entry.id] });
  }

  async function removeComment(id: string) {
    await supabase.from("comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["comments", entry?.id] });
  }

  return (
    <section className="paper p-6 sm:p-8">
      <p className="text-sm text-muted-foreground">{format(date, "yyyy년 M월 d일 EEEE", { locale: ko })}</p>
      {isLoading ? null : editing ? (
        <div className="mt-4 space-y-4">
          <Input placeholder="제목 (선택)" value={title} onChange={(e) => setTitle(e.target.value)} className="font-serif text-lg" />
          <Textarea
            placeholder="오늘 있었던 일을 적어 보세요…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="lined min-h-80 resize-y border-none bg-transparent font-serif text-base shadow-none focus-visible:ring-0"
          />
          <div className="flex justify-end gap-2">
            {entry && (
              <Button variant="ghost" onClick={() => setEditing(false)}>
                취소
              </Button>
            )}
            <Button onClick={save}>저장</Button>
          </div>
        </div>
      ) : entry ? (
        <>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h2 className="text-2xl font-bold">{entry.title || "제목 없음"}</h2>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              수정
            </Button>
          </div>
          <p className="lined mt-4 whitespace-pre-wrap font-serif">{entry.content}</p>

          <div className="mt-10 border-t pt-6">
            <h3 className="mb-4 font-bold">댓글 {comments.length}</h3>
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-muted px-4 py-3 text-sm">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {nickname || "나"} · {format(new Date(c.created_at), "M.d HH:mm")}
                    </span>
                    <button onClick={() => removeComment(c.id)} className="hover:text-destructive">
                      삭제
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap">{c.content}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <Input
                placeholder="댓글 달기"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && addComment()}
              />
              <Button onClick={addComment}>등록</Button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
