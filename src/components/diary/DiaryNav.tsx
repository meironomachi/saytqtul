import { Link } from "@tanstack/react-router";
import { CalendarDays, ChartNoAxesCombined, List, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DiaryNav() {
  return <nav aria-label="일기 메뉴" className="mb-8 flex flex-wrap gap-1 border-b pb-3">
    {([{ to: "/calendar", label: "달력", icon: CalendarDays }, { to: "/reports", label: "월간 리포트", icon: ChartNoAxesCombined }, { to: "/search", label: "검색", icon: Search }, { to: "/timeline", label: "타임라인", icon: List }] as const).map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" size="sm"><Link to={to} activeProps={{ className: "bg-accent text-accent-foreground" }}><Icon className="size-4" />{label}</Link></Button>)}
  </nav>;
}