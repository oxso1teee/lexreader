// docs/moments/mockups/Progress.dc.html — "Последние 5 недель": 7×5 клеток
// (Пн→Вс по столбцам, 5 строк недель), 4-ступенчатая шкала по реальному
// activityCounts (тот же источник, что у ActivityHeatmap — другая, более
// компактная раскладка, не отдельный запрос).
const DAYS_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function levelClass(count: number): string {
  if (count === 0) return "bg-[var(--surface-muted)]";
  if (count <= 2) return "bg-[var(--color-forest-tint)]";
  if (count <= 5) return "bg-[var(--color-forest-tint-strong)]";
  return "bg-[var(--color-forest)]";
}

export default function FiveWeekGrid({ counts }: { counts: Record<string, number> }) {
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Текущая неделя заканчивается сегодня, но для выравнивания по столбцам
  // Пн..Вс берём конец на ближайшее воскресенье текущей недели (ISO:
  // getUTCDay()===0 -> воскресенье).
  const daysUntilSunday = (7 - todayUTC.getUTCDay()) % 7;
  const weekEnd = new Date(todayUTC);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + daysUntilSunday);

  const cells = Array.from({ length: 35 }, (_, i) => {
    const d = new Date(weekEnd);
    d.setUTCDate(d.getUTCDate() - (34 - i));
    const key = isoDate(d);
    const isFuture = d > todayUTC;
    return { key, count: isFuture ? 0 : counts[key] ?? 0, isFuture };
  });

  return (
    <div>
      <div className="grid grid-cols-7 gap-[5px]">
        {cells.map((cell) => (
          <div
            key={cell.key}
            title={`${cell.key}: ${cell.count}`}
            className={`h-[22px] rounded-[6px] ${cell.isFuture ? "border border-dashed border-[var(--border)]" : levelClass(cell.count)}`}
          />
        ))}
      </div>
      <div className="mt-1.5 grid grid-cols-7 gap-[5px] text-center text-[11px] font-semibold text-[var(--text-secondary)]">
        {DAYS_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}
