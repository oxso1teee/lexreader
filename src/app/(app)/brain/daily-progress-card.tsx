// Practice Home "daily progress" (Slice 4 §5). Target is honestly derived
// from today's actual queue size (due+new at page load) — matching the
// approved artifact's own numbers (8/20 reviewed = 40%) — rather than a
// separate stored preference that could silently drift from what's real.
export default function DailyProgressCard({
  reviewedToday,
  target,
}: {
  reviewedToday: number;
  target: number;
}) {
  const percent = target > 0 ? Math.min(100, Math.round((reviewedToday / target) * 100)) : reviewedToday > 0 ? 100 : 0;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Сегодня</h2>
        <span className="text-xs text-[var(--text-secondary)]">
          {target > 0 ? `Цель дня: ${percent}%` : "Нет карточек на сегодня"}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold">
        {reviewedToday}
        {target > 0 && <span className="text-base font-normal text-[var(--text-secondary)]"> / {target}</span>}
      </p>
      <p className="text-xs text-[var(--text-secondary)]">карточек повторено</p>
      {target > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <div className="h-full rounded-full bg-forest transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
