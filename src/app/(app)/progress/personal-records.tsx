import { Flame, Award, CheckCircle2, Layers, type LucideIcon } from "lucide-react";
import { cardClassName } from "@/components/ui/card";

// Раздел 5 промта 2026-07-30 (полировка): те же данные, что уже считаются
// на этом экране — просто собранные так, чтобы вызывать гордость, а не
// только информировать.
//
// docs/release-2026-08-26/12_VIZUALNAYA_IDENTICHNOST_RESHENIE_2026-08-26.md
// — единственный акцент. Раньше это был единственный блок на странице,
// оставшийся на плоских bg-black/5-плитках без какого-либо акцента,
// пока StatCard/AchievementsShelf/ActivityHeatmap уже перешли на forest
// (PR #50) — иконка-эмодзи внутри forest-tint кружка (тот же паттерн, что
// уже даёт AchievementsShelf разблокированным ачивкам), число крупным
// жирным шрифтом отдельной строкой — та же иерархия размером/весом, что
// уже использует StatCard, не цветом.
export default function PersonalRecords({
  bestStreak,
  bestWordsDay,
  bestSession,
  bestReviewsDay,
}: {
  bestStreak: number;
  bestWordsDay: number;
  bestSession: number;
  bestReviewsDay: number;
}) {
  const records: { icon: LucideIcon; value: number; label: string }[] = [
    { icon: Flame, value: bestStreak, label: "лучший стрик" },
    { icon: Award, value: bestWordsDay, label: "слов за день" },
    { icon: CheckCircle2, value: bestSession, label: "лучшая сессия" },
    { icon: Layers, value: bestReviewsDay, label: "карточек за день" },
  ];

  return (
    <div className={cardClassName()}>
      <h2 className="mb-3 font-semibold">Личные рекорды</h2>
      <div className="grid grid-cols-2 gap-3">
        {records.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-xl bg-[var(--border)] px-3 py-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-tint)]"
            >
              <r.icon className="h-4 w-4 text-[var(--color-forest-text)]" />
            </span>
            <div className="min-w-0">
              {/* forest-text-contrast-fix: see stat-card.tsx for why
                  --color-forest-text, not text-forest. */}
              <p className="text-lg font-bold text-[var(--color-forest-text)]">{r.value}</p>
              <p className="truncate text-xs text-[var(--text-secondary)]">{r.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
