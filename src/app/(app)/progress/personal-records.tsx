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
  const records = [
    { icon: "🔥", value: bestStreak, label: "лучший стрик" },
    { icon: "💯", value: bestWordsDay, label: "слов за день" },
    { icon: "✅", value: bestSession, label: "лучшая сессия" },
    { icon: "📇", value: bestReviewsDay, label: "карточек за день" },
  ];

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">Личные рекорды</h2>
      <div className="grid grid-cols-2 gap-3">
        {records.map((r) => (
          <div key={r.label} className="flex items-center gap-3 rounded-xl bg-black/5 px-3 py-2.5 dark:bg-white/10">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-forest-tint)] text-base"
            >
              {r.icon}
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
