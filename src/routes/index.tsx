import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "일기장 — 나의 하루를 적어요" },
      { name: "description", content: "달력에서 날짜를 골라 하루를 기록하고 다시 읽어보는 나만의 일기장" },
      { property: "og:title", content: "일기장" },
      { property: "og:description", content: "달력에서 날짜를 골라 하루를 기록하는 나만의 일기장" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mb-4 text-sm tracking-[0.4em] text-muted-foreground">MY DIARY</p>
      <h1 className="text-7xl font-bold text-foreground sm:text-9xl">일기장</h1>
      <p className="mt-6 text-muted-foreground">오늘 하루는 어땠나요?</p>
      <Button asChild size="lg" className="mt-10 h-12 rounded-full px-10 text-base">
        <Link to="/calendar">적으러 가기</Link>
      </Button>
    </main>
  );
}
