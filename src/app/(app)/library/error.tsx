"use client";

// Real Next.js error boundary for this route segment — activates when the
// server component's data fetch throws. reset() re-runs the segment, which
// is a genuine retry, not a decorative button (docs/ui/m3-slice3-library-reader-plan.md §5).
import { useEffect } from "react";
import { log } from "@/lib/log";

export default function LibraryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    log.error({ kind: "library", message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-3 px-5 py-20 text-center">
      <span className="text-3xl" aria-hidden>
        ⚠️
      </span>
      <h1 className="text-h2">Не удалось загрузить библиотеку</h1>
      <p className="max-w-sm text-sm text-[var(--text-secondary)]">
        Проверь соединение и попробуй ещё раз. Твои материалы никуда не делись — проблема только с загрузкой списка.
      </p>
      <button
        type="button"
        onClick={reset}
        className="focus-ring mt-2 min-h-11 rounded-full bg-[var(--color-forest)] px-5 text-sm font-bold text-white"
      >
        Повторить
      </button>
    </div>
  );
}
