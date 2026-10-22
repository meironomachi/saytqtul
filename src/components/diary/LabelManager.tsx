import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Label } from "@/lib/diary";

export function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    queryFn: async () =>
      ((await supabase.from("labels").select("id, kind, name, color").order("created_at")).data ?? []) as Label[],
  });
}

export function LabelManager() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">태그 관리</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>태그 관리</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="mood">
          <TabsList className="w-full">
            <TabsTrigger value="mood" className="flex-1">기분</TabsTrigger>
            <TabsTrigger value="activity" className="flex-1">한 일</TabsTrigger>
          </TabsList>
          <TabsContent value="mood"><KindList kind="mood" /></TabsContent>
          <TabsContent value="activity"><KindList kind="activity" /></TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function KindList({ kind }: { kind: "mood" | "activity" }) {
  const qc = useQueryClient();
  const { data = [] } = useLabels();
  const list = data.filter((l) => l.kind === kind);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0031B0");
  const refresh = () => qc.invalidateQueries({ queryKey: ["labels"] });

  async function add() {
    if (!name.trim()) return;
    const { error } = await supabase.from("labels").insert({ kind, name: name.trim(), color });
    if (error) { toast.error("추가하지 못했어요."); return; }
    setName("");
    refresh();
  }
  async function update(id: string, patch: { name?: string; color?: string }) {
    await supabase.from("labels").update(patch).eq("id", id);
    refresh();
  }
  async function remove(id: string) {
    await supabase.from("labels").delete().eq("id", id);
    refresh();
  }

  return (
    <div className="space-y-3 pt-2">
      <ul className="space-y-2">
        {list.map((l) => (
          <li key={l.id} className="flex items-center gap-2">
            <input
              type="color"
              defaultValue={l.color}
              onBlur={(e) => e.target.value !== l.color && update(l.id, { color: e.target.value })}
              className="h-9 w-9 shrink-0 cursor-pointer rounded border bg-transparent"
              aria-label="색상"
            />
            <Input
              defaultValue={l.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== l.name && update(l.id, { name: e.target.value.trim() })}
            />
            <Button variant="ghost" size="sm" onClick={() => remove(l.id)} className="text-destructive">삭제</Button>
          </li>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">아직 태그가 없어요.</p>}
      </ul>
      <div className="flex items-center gap-2 border-t pt-3">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded border bg-transparent" aria-label="새 색상" />
        <Input
          placeholder={kind === "mood" ? "예: 행복" : "예: 공부"}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && add()}
        />
        <Button onClick={add}>추가</Button>
      </div>
    </div>
  );
}
