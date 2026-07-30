"use client";

import { useEffect, useRef } from "react";

const STORAGE_KEY = "lexreader_last_streak";

// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 5: короткий пульс
// на стрике, когда он вырос со времени последнего визита — единственный
// момент в интерфейсе, где он сам "хвалит" пользователя. Класс анимации
// включается напрямую через DOM (не через React state), чтобы не тянуть
// значение из localStorage в рендер и не расходиться с SSR-разметкой.
export default function StreakPill({ streak }: { streak: number }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const last = Number(window.localStorage.getItem(STORAGE_KEY) ?? "0");
    window.localStorage.setItem(STORAGE_KEY, String(streak));
    if (streak > last) ref.current?.classList.add("streak-pulse");
  }, [streak]);

  return (
    <span
      ref={ref}
      className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-sm font-bold tabular-nums text-accent-strong"
    >
      🔥 {streak}
    </span>
  );
}
