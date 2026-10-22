import { Slider } from "@/components/ui/slider";
import { LabelManager } from "@/components/diary/LabelManager";
import { addMood, MAX_MOODS, type Label, type Mood } from "@/lib/diary";

export function MoodEditor({ labels, moods, onChange, readOnly }: { labels: Label[]; moods: Mood[]; onChange?: (m: Mood[]) => void; readOnly?: boolean }) {
  const moodLabels = labels.filter((l) => l.kind === "mood");
  const byId = new Map(labels.map((l) => [l.id, l]));
  const shown = moods.filter((m) => byId.has(m.label_id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">오늘의 기분 {!readOnly && <span className="text-xs font-normal text-muted-foreground">({moods.length}/{MAX_MOODS})</span>}</h3>
        {!readOnly && <LabelManager kind="mood" buttonLabel="기분 태그 관리" title="기분 태그 관리" />}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {moodLabels.length === 0 && <p className="text-sm text-muted-foreground">'기분 태그 관리'에서 기분 태그를 만들어 보세요.</p>}
          {moodLabels.map((l) => {
            const on = moods.some((m) => m.label_id === l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onChange?.(on ? moods.filter((m) => m.label_id !== l.id) : addMood(moods, l.id))}
                disabled={!on && moods.length >= MAX_MOODS}
                className="rounded-full border px-3 py-1 text-sm transition disabled:opacity-40"
                style={on ? { backgroundColor: l.color, borderColor: l.color, color: "white" } : { borderColor: l.color }}
              >
                {l.name}
              </button>
            );
          })}
        </div>
      )}
      <ul className="space-y-3">
        {shown.map((m) => {
          const l = byId.get(m.label_id)!;
          return (
            <li key={m.label_id} className="flex items-center gap-3">
              <span className="w-20 shrink-0 truncate text-sm font-medium" style={{ color: l.color }}>{l.name}</span>
              {readOnly ? (
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${m.score}%`, backgroundColor: l.color }} />
                </div>
              ) : (
                <Slider
                  className="flex-1"
                  value={[m.score]}
                  max={100}
                  step={1}
                  onValueChange={([v]) => onChange?.(moods.map((x) => (x.label_id === m.label_id ? { ...x, score: v ?? 0 } : x)))}
                />
              )}
              <span className="w-8 text-right text-sm tabular-nums text-muted-foreground">{m.score}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
