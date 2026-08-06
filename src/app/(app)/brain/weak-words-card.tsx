import Link from "next/link";
import type { HardestWord } from "@/lib/brain-stats";

// Practice Home "weak words" (Slice 4 §5): same ranking as Progress's
// "Сложные слова" (src/lib/brain-stats.ts, computeHardestWords) — reused,
// not reimplemented. Honest empty state when there isn't enough review
// history yet (fewer than MIN_ATTEMPTS_FOR_ACCURACY attempts on any card).
export default function WeakWordsCard({ words }: { words: HardestWord[] }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Слабые слова</h2>
        <Link href="/brain/vocabulary" className="text-sm text-[var(--color-caramel-text)]">
          Все →
        </Link>
      </div>
      {words.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Пока недостаточно повторений, чтобы найти сложные слова.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {words.map((w) => (
            <div key={w.id} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{w.front}</span>
                <span className="text-[var(--text-secondary)]"> — {w.back}</span>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                  w.accuracy < 0.4
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : w.accuracy < 0.7
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                точность {Math.round(w.accuracy * 100)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
