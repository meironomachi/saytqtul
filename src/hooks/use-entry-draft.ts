import { useEffect, useRef, useState } from "react";
import { draftKey, type EntryDraft } from "@/lib/diary";

export function useEntryDraft(userId: string, day: string, fields: EntryDraft, enabled: boolean) {
  const [status, setStatus] = useState<"saved" | "pending" | "error" | null>(null);
  const key = draftKey(userId, day);
  const latest = useRef(fields);
  latest.current = fields;
  const skip = useRef(false);
  const dirty = useRef(false);
  const previous = useRef("");

  useEffect(() => {
    if (!enabled) return;
    skip.current = false;
    previous.current = JSON.stringify(latest.current);
    function flush() {
      if (skip.current || !dirty.current) return;
      try {
        localStorage.setItem(key, JSON.stringify({ updatedAt: Date.now(), fields: latest.current }));
        dirty.current = false;
      } catch { /* The in-screen status reports storage errors. */ }
    }
    window.addEventListener("pagehide", flush);
    return () => { flush(); window.removeEventListener("pagehide", flush); };
  }, [enabled, key]);

  const serialized = JSON.stringify(fields);
  useEffect(() => {
    if (!enabled || previous.current === serialized) return;
    previous.current = serialized;
    dirty.current = true;
    skip.current = false;
    setStatus("pending");
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ updatedAt: Date.now(), fields: latest.current }));
        dirty.current = false;
        setStatus("saved");
      } catch { setStatus("error"); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [serialized, enabled, key]);

  function clearDraft() {
    skip.current = true;
    dirty.current = false;
    try { localStorage.removeItem(key); } catch { /* Saving the entry is not blocked by unavailable local storage. */ }
    setStatus(null);
  }
  return { status, clearDraft };
}