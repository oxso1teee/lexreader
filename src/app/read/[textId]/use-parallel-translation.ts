"use client";

import { useEffect, useRef, useState } from "react";

// M3 Slice 3 Parallel mode: no paid API, no whole-book translation on every
// open. Each visible sentence is its own chunk — already the natural unit
// the Reader computes (no new splitting logic needed) and short enough to
// always clear MyMemory's per-request length limit. Reuses the *existing*
// /api/translate endpoint (passing the sentence as the "word" field, same
// shape the word-lookup popup already uses for sentence context) — so
// caching (translations_cache) and rate limiting (translate_requests, 30/min)
// are the same, already-proven infrastructure, not new code.
// Progressive + capped concurrency so entering Parallel mode on a long page
// doesn't fire 15 requests at once.
const CONCURRENCY = 3;

export type ParallelStatus = "idle" | "loading" | "done" | "error" | "unavailable";

export function useParallelTranslation({
  active,
  sentences,
  sourceLang,
  targetLang,
}: {
  active: boolean;
  sentences: string[];
  sourceLang: string;
  targetLang: string;
}) {
  const [translations, setTranslations] = useState<Record<number, string>>({});
  const [statuses, setStatuses] = useState<Record<number, ParallelStatus>>({});
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!active || sentences.length === 0) return;
    let cancelled = false;

    async function translateOne(i: number) {
      const sentence = sentences[i];
      const cacheKey = `${sourceLang}:${targetLang}:${sentence}`;
      const cached = cacheRef.current.get(cacheKey);
      if (cached !== undefined) {
        setTranslations((t) => ({ ...t, [i]: cached }));
        setStatuses((s) => ({ ...s, [i]: "done" }));
        return;
      }

      setStatuses((s) => ({ ...s, [i]: "loading" }));
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: sentence, sourceLang, targetLang }),
        });
        if (cancelled) return;
        if (res.status === 429 || res.status === 503) {
          setStatuses((s) => ({ ...s, [i]: "unavailable" }));
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "translation failed");
        cacheRef.current.set(cacheKey, data.wordTranslation);
        setTranslations((t) => ({ ...t, [i]: data.wordTranslation }));
        setStatuses((s) => ({ ...s, [i]: "done" }));
      } catch {
        if (!cancelled) setStatuses((s) => ({ ...s, [i]: "error" }));
      }
    }

    async function runQueue() {
      let next = 0;
      const indices = sentences.map((_, i) => i);
      async function worker() {
        while (next < indices.length) {
          const i = indices[next];
          next += 1;
          if (cancelled) return;
          await translateOne(i);
        }
      }
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, indices.length) }, worker));
    }

    runQueue();
    return () => {
      cancelled = true;
    };
  }, [active, sentences, sourceLang, targetLang]);

  return { translations, statuses };
}
