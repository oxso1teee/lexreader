export interface HardestWord {
  id: string;
  front: string;
  back: string;
  accuracy: number;
  total: number;
}

export default function HardestWords({ words }: { words: HardestWord[] }) {
  if (words.length === 0) return null;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="mb-1 font-semibold">Сложные слова</h2>
      <p className="mb-3 text-xs text-black/40 dark:text-white/40">
        По точности ответов за всё время, худшие сначала
      </p>
      <div className="flex flex-col gap-2">
        {words.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{w.front}</span>
              <span className="text-black/50 dark:text-white/50"> — {w.back}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-black/40 dark:text-white/40">{w.total}×</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  w.accuracy < 0.4
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : w.accuracy < 0.7
                      ? "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                }`}
              >
                {Math.round(w.accuracy * 100)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
