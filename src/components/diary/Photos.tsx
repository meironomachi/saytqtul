import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const BUCKET = "diary-photos";

export function Photos({ userId, paths, onChange, readOnly }: { userId: string; paths: string[]; onChange?: (p: string[]) => void; readOnly?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data: urls = {} } = useQuery({
    queryKey: ["photo-urls", paths],
    enabled: paths.length > 0,
    queryFn: async () => {
      const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
      return Object.fromEntries((data ?? []).map((d) => [d.path, d.signedUrl]));
    },
  });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: string[] = [];
    for (const f of Array.from(files)) {
      const path = `${userId}/${crypto.randomUUID()}.${f.name.split(".").pop() || "jpg"}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: f.type });
      if (error) toast.error(`${f.name}을(를) 올리지 못했어요.`);
      else added.push(path);
    }
    setBusy(false);
    onChange?.([...paths, ...added]);
    if (input.current) input.current.value = "";
  }

  async function remove(p: string) {
    await supabase.storage.from(BUCKET).remove([p]);
    onChange?.(paths.filter((x) => x !== p));
  }

  if (readOnly && paths.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">사진</h3>
        {!readOnly && (
          <>
            <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "올리는 중…" : "사진 추가"}
            </Button>
          </>
        )}
      </div>
      {paths.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {paths.map((p) => (
            <div key={p} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
              {urls[p] && (
                <a href={urls[p]} target="_blank" rel="noreferrer">
                  <img src={urls[p]} alt="첨부 사진" className="h-full w-full object-cover" />
                </a>
              )}
              {!readOnly && (
                <button type="button" onClick={() => remove(p)} className="absolute right-1 top-1 rounded-md bg-background/90 px-2 py-0.5 text-xs text-destructive">
                  삭제
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export async function removePhotos(paths: string[]) {
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
