import { useEffect, useRef, useState } from "react";
import { HOURS, minutesByLabel, paintSlot, slotIndex, SLOTS_PER_HOUR, type Label, type Timetable } from "@/lib/diary";

export function TimetableGrid({ labels, value, onChange, readOnly }: { labels: Label[]; value: Timetable; onChange?: (t: Timetable) => void; readOnly?: boolean }) {
  const acts = labels.filter((l) => l.kind === "activity");
  const byId = new Map(labels.map((l) => [l.id, l]));
  const [brush, setBrush] = useState<string | null>(null);
  const painting = useRef<string | null | undefined>(undefined);
  const current = useRef(value);
  current.current = value;

  useEffect(() => {
    if (brush === null && acts[0]) setBrush(acts[0].id);
  }, [acts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const up = () => (painting.current = undefined);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  function apply(slot: number) {
    if (painting.current === undefined) return;
    onChange?.(paintSlot(current.current, slot, painting.current));
  }

  const totals = minutesByLabel(value);

  return (
    <div className="space-y-3">
      <h3 className="font-bold">타임테이블</h3>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {acts.length === 0 && <p className="text-sm text-muted-foreground">'태그 관리'에서 한 일 태그를 만들어 보세요.</p>}
          {acts.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setBrush(l.id)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm"
              style={brush === l.id ? { borderColor: l.color, boxShadow: `0 0 0 1px ${l.color}` } : undefined}
            >
              <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: l.color }} />
              {l.name}
            </button>
          ))}
          <button type="button" onClick={() => setBrush(null)} className={`rounded-full border px-3 py-1 text-sm ${brush === null ? "ring-1 ring-foreground" : ""}`}>
            지우개
          </button>
        </div>
      )}
      <div className="select-none touch-none" onPointerLeave={() => undefined}>
        {HOURS.map((h) => (
          <div key={h} className="flex items-center gap-2">
            <span className="w-6 text-right text-[11px] tabular-nums text-muted-foreground">{String(h).padStart(2, "0")}</span>
            <div className="grid flex-1 grid-cols-6 border-l border-t">
              {Array.from({ length: SLOTS_PER_HOUR }, (_, p) => {
                const s = slotIndex(h, p);
                const l = value[s] ? byId.get(value[s]) : undefined;
                return (
                  <div
                    key={p}
                    data-slot={s}
                    className={`aspect-square border-b border-r ${readOnly ? "" : "cursor-pointer"}`}
                    style={l ? { backgroundColor: l.color } : undefined}
                    onPointerDown={(e) => {
                      if (readOnly) return;
                      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                      painting.current = value[s] === brush ? null : brush;
                      apply(s);
                    }}
                    onPointerEnter={() => !readOnly && apply(s)}
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
