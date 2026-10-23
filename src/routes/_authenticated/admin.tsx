import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "가입 승인 — 일기장" },
      { name: "description", content: "가입 요청을 승인하거나 취소해요" },
      { property: "og:title", content: "가입 승인 — 일기장" },
      { property: "og:description", content: "가입 요청을 승인하거나 취소해요" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data: people = [], isLoading } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () =>
      (await supabase.from("profiles").select("id, nickname, email, approved, created_at").order("created_at", { ascending: false })).data ?? [],
  });

  async function setApproved(id: string, approved: boolean) {
    const { error } = await supabase.rpc("approve_user", { _user_id: id, _approved: approved });
    if (error) {
      toast.error("관리자만 승인할 수 있어요.");
      return;
    }
    toast.success(approved ? "승인했어요" : "승인을 취소했어요");
    qc.invalidateQueries({ queryKey: ["all-profiles"] });
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">가입 승인</h1>
        <Button asChild variant="ghost" size="sm">
          <Link to="/calendar">달력으로</Link>
        </Button>
      </header>
      <ul className="paper divide-y">
        {!isLoading && people.length === 0 && (
          <li className="p-6 text-center text-muted-foreground">관리자만 볼 수 있는 화면이에요.</li>
        )}
        {people.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{p.nickname || "이름 없음"}</p>
              <p className="text-sm text-muted-foreground">{p.email}</p>
            </div>
            {p.id === user.id ? (
              <span className="text-sm text-muted-foreground">관리자</span>
            ) : p.approved ? (
              <Button variant="outline" size="sm" onClick={() => setApproved(p.id, false)}>
                승인 취소
              </Button>
            ) : (
              <Button size="sm" onClick={() => setApproved(p.id, true)}>
                승인
              </Button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
