import { Sun, Cloud, CloudRain, Snowflake, Wind } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WEATHER, type Weather } from "@/lib/diary";

const icons = { sunny: Sun, cloudy: Cloud, rainy: CloudRain, snowy: Snowflake, windy: Wind };

export function WeatherPicker({ value, onChange, readOnly = false }: { value: Weather | null; onChange?: (v: Weather | null) => void; readOnly?: boolean }) {
  if (readOnly) {
    const item = WEATHER.find((w) => w.id === value);
    if (!item) return null;
    const Icon = icons[item.id];
    return <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><Icon className="size-4" />{item.name}</span>;
  }
  return <div className="space-y-2"><h3 className="font-bold">오늘의 날씨</h3><div className="flex flex-wrap gap-2">{WEATHER.map((w) => {
    const Icon = icons[w.id];
    return <Button key={w.id} type="button" variant={value === w.id ? "default" : "outline"} size="sm" aria-pressed={value === w.id} onClick={() => onChange?.(value === w.id ? null : w.id)}><Icon className="size-4" />{w.name}</Button>;
  })}</div></div>;
}