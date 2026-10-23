import { useEffect, useRef, useState } from "react";
import { LabelManager } from "@/components/diary/LabelManager";
import { Button } from "@/components/ui/button";
import { Eraser } from "lucide-react";
import { HOURS, minutesByLabel, paintRange, slotIndex, SLOTS_PER_HOUR, type Label, type Timetable } from "@/lib/diary";

export function TimetableGrid({ labels, value, onChange, readOnly }: { labels: Label[]; value: Timetable; onChange?: (t: Timetable) => void; readOnly?: boolean }) {
  const acts = labels.filter((l) => l.kind === "activity");
  const byId = new Map(labels.map((l) => [l.id, l]));
  const [brush, setBrush] = useState<string | null>(null);
  const painting = useRef<string | null | undefined>(undefined);
  const lastSlot = useRef<number | null>(null);
  const current = useRef(value);
  current.current = value;

  useEffect(() => {
    if (brush === null && acts[0]) setBrush(acts[0].id);
  }, [acts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const up = () => { painting.current = undefined; lastSlot.current = null; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  function apply(slot: number) {
    if (painting.current === undefined) return;
    const next = paintRange(current.current, lastSlot.current ?? slot, slot, painting.current);
    current.current = next;
    lastSlot.current = slot;
    onChange?.(next);
  }

  const totals = minutesByLabel(value);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">타임테이블</h3>
        {!readOnly && <LabelManager kind="activity" buttonLabel="한 일 태그 관리" title="한 일 태그 관리" />}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {acts.length === 0 && <p className="text-sm text-muted-foreground">'한 일 태그 관리'에서 태그를 만들어 보세요.</p>}
          {acts.map((l) => (
            <Button
              key={l.id}
              type="button"
              onClick={() => setBrush(l.id)}
              variant="outline"
              size="sm"
              aria-pressed={brush === l.id}
              className={brush === l.id ? "ring-1 ring-primary" : ""}
              style={brush === l.id ? { borderColor: l.color, boxShadow: `0 0 0 1px ${l.color}` } : undefined}
            >
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
              {l.name}
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" aria-pressed={brush === null} onClick={() => setBrush(null)} className={brush === null ? "ring-1 ring-foreground" : ""}><Eraser className="size-4" />지우개</Button>
        </div>
      )}
      <div className="w-full max-w-xs select-none touch-none" onPointerMove={(e) => {
          if (readOnly || painting.current === undefined) return;
          const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
          const slot = el?.dataset['slot'];
           if (slot !== undefined && lastSlot.current !== Number(slot)) apply(Number(slot));
        }}>
        {HOURS.map((h) => (
          <div key={h} className="flex items-center gap-2">
            <span className="w-6 text-right text-[11px] tabular-nums text-muted-foreground">{String(h).padStart(2, "0")}</span>
            <div className="grid flex-1 grid-cols-6 border-l border-t">
              {Array.from({ length: SLOTS_PER_HOUR }, (_, p) => {
                const s = slotIndex(h, p);
                const l = value[s] ? byId.get(value[s]) : undefined;
                return (
                   <Button
                    key={p}
                    data-slot={s}
                     type="button"
                     variant="ghost"
                     aria-label={`${h}시 ${p * 10}분${l ? ` ${l.name}` : ""}`}
                     aria-disabled={readOnly}
                     tabIndex={readOnly ? -1 : 0}
                     className="aspect-square h-auto w-full min-w-0 rounded-none border-b border-r p-0 hover:opacity-80"
                    style={l ? { backgroundColor: l.color } : undefined}
                    onPointerDown={(e) => {
                       if (readOnly || e.button !== 0) return;
                       if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                      painting.current = value[s] === brush ? null : brush;
                       lastSlot.current = s;
                      apply(s);
                    }}
                     onKeyDown={(e) => {
                       if (readOnly || (e.key !== "Enter" && e.key !== " ")) return;
                       e.preventDefault();
                       onChange?.(paintRange(current.current, s, s, value[s] === brush ? null : brush));
                     }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {Object.keys(totals).length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {Object.entries(totals).map(([id, min]) => {
            const l = byId.get(id);
            if (!l) return null;
            return (
              <li key={id} className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
                {l.name} {Math.floor(min / 60) ? `${Math.floor(min / 60)}시간 ` : ""}{min % 60 ? `${min % 60}분` : ""}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
