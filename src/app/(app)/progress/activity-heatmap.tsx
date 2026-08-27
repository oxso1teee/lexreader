"use client";

import { useState } from "react";

const DAYS = 91; // 13 недель

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// feat/hybrid-gamification-visuals: раньше 4 уровня активности красились в
// захардкоженные emerald-300/500/700 — цвет библиотеки по умолчанию, никак
// не связанный с брендом. Теперь та же 4-ступенчатая шкала на forest-
// токенах — каждый уже сам разруливает light/dark через свой :root[data-
// theme="dark"]-оверрайд в tokens.css, отдельный dark:-вариант тут не нужен.
function levelClass(count: number): string {
  if (count === 0) return "bg-[var(--surface-muted)]";
  if (count <= 2) return "bg-[var(--color-forest-tint)]";
  if (count <= 5) return "bg-[var(--color-forest-tint-strong)]";
  return "bg-[var(--color-forest)]";
}

export default function ActivityHeatmap({ counts }: { counts: Record<string, number> }) {
  const [selected, setSelected] = useState<{ key: string; count: number } | null>(null);

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
          <button
            key={day.key}
            type="button"
            title={`${day.key}: ${day.count}`}
            aria-label={`${day.key}: ${day.count} действий`}
            onClick={() => setSelected(day)}
            className={`h-3 w-3 rounded-sm ${levelClass(day.count)}`}
          />
        ))}
      </div>
      <p className="mt-2 text-xs text-[var(--text-secondary)]">
        {/* P0-АУДИТ (раздел 5): title недоступен на тач-устройствах — тап по
            клетке показывает то же самое здесь. */}
        {selected
          ? `${selected.key}: ${selected.count} действий`
          : "Активность за последние 13 недель — нажми на клетку для деталей"}
      </p>
    </div>
  );
}
