import { cardClassName } from "@/components/ui/card";

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
    <div className={cardClassName()}>
      <h2 className="mb-1 font-semibold">Сложные слова</h2>
      <p className="mb-3 text-xs text-[var(--text-secondary)]">
        По точности ответов за всё время, худшие сначала
      </p>
      <div className="flex flex-col gap-2">
        {words.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0">
              <span className="font-medium">{w.front}</span>
              <span className="text-[var(--text-secondary)]"> — {w.back}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)]">{w.total}×</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  w.accuracy < 0.4
                    ? "bg-[var(--color-danger)]/15 text-[var(--color-danger-text)]"
                    : w.accuracy < 0.7
                      ? "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]"
                      : "bg-[var(--color-success)]/15 text-[var(--color-success-text)]"
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
