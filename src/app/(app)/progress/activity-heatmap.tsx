const DAYS = 91; // 13 недель

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function levelClass(count: number): string {
  if (count === 0) return "bg-black/5 dark:bg-white/10";
  if (count <= 2) return "bg-emerald-300 dark:bg-emerald-900";
  if (count <= 5) return "bg-emerald-500 dark:bg-emerald-700";
  return "bg-emerald-700 dark:bg-emerald-500";
}

export default function ActivityHeatmap({ counts }: { counts: Record<string, number> }) {
  const now = new Date();
  // isoDate ниже режет через toISOString (UTC) — якорим "сегодня" тоже в UTC,
  // иначе на сервере не в UTC-таймзоне последняя клетка сдвигается на день назад.
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(todayUTC);
    d.setUTCDate(d.getUTCDate() - (DAYS - 1 - i));
    const key = isoDate(d);
    return { key, count: counts[key] ?? 0 };
  });

  return (
    <div>
      <div
        className="grid gap-1"
        style={{
          gridTemplateRows: "repeat(7, 1fr)",
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
        }}
      >
        {days.map((day) => (
          <div
            key={day.key}
            title={`${day.key}: ${day.count}`}
            className={`h-3 w-3 rounded-sm ${levelClass(day.count)}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-black/40 dark:text-white/40">Активность за последние 13 недель</p>
    </div>
  );
}
