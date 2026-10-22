import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "로그인 — 일기장" },
      { name: "description", content: "일기장에 로그인하거나 가입하세요" },
      { property: "og:title", content: "로그인 — 일기장" },
      { property: "og:description", content: "일기장에 로그인하거나 가입하세요" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/calendar", replace: true });
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/calendar", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error("로그인에 실패했어요. 이메일과 비밀번호를 확인해 주세요.");
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { nickname } },
      });
      if (error) toast.error(error.message);
      else toast.success("확인 메일을 보냈어요. 메일의 링크를 누르면 가입이 완료돼요.");
    }
    setBusy(false);
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) toast.error("구글 로그인에 실패했어요.");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="paper w-full max-w-sm p-8">
        <Link to="/" className="block text-center text-4xl font-bold">
          일기장
        </Link>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          {mode === "in" ? "다시 오신 걸 환영해요" : "새 일기장을 만들어요"}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "up" && (
            <div className="space-y-1.5">
              <Label htmlFor="nick">닉네임</Label>
              <Input id="nick" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">이메일</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">비밀번호</Label>
            <Input
              id="pw"
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "in" ? "로그인" : "가입하기"}
          </Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />또는<div className="h-px flex-1 bg-border" />
        </div>
        <Button variant="outline" className="w-full" onClick={google}>
          구글로 계속하기
        </Button>
        <button
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
          className="mt-6 w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {mode === "in" ? "계정이 없나요? 가입하기" : "이미 계정이 있나요? 로그인"}
        </button>
      </div>
    </main>
  );
}
