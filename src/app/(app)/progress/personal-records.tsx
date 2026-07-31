// Раздел 5 промта 2026-07-30 (полировка): те же данные, что уже считаются
// на этом экране — просто собранные так, чтобы вызывать гордость, а не
// только информировать.
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
      <h2 className="mb-2 font-semibold">Личные рекорды</h2>
      <div className="grid grid-cols-2 gap-3">
        {records.map((r) => (
          <div key={r.label} className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
            <p className="text-lg font-bold">
              {r.icon} {r.value}
            </p>
            <p className="text-xs text-black/50 dark:text-white/50">{r.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
