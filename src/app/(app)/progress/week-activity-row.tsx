const WEEKDAYS = [
  { short: "Пн", full: "Понедельник" },
  { short: "Вт", full: "Вторник" },
  { short: "Ср", full: "Среда" },
  { short: "Чт", full: "Четверг" },
  { short: "Пт", full: "Пятница" },
  { short: "Сб", full: "Суббота" },
  { short: "Вс", full: "Воскресенье" },
] as const;

// Progress mockup alignment — 7 точек текущей недели (Пн..Вс), честные
// данные без нового запроса: page.tsx уже считает activityCounts
// (Record<ISO-дата, count>, покрывает 91 день — текущая неделя всегда
// внутри) для ActivityHeatmap ниже на странице, здесь просто читаем те же
// 7 дней из него. Компонент — чистая презентация: принимает готовый
// activeDays (7 булевых значений, Пн→Вс), сам ничего не запрашивает.
// Будущие дни недели (ещё не наступили) уже честно false в activityCounts
// (там просто нет ключа для даты в будущем) — отдельной логики не нужно.
//
// Своя карточка (rounded-2xl bg-card p-4 shadow-sm), тот же приём, что и у
// StreakHero прямо над ней и у всех остальных секций этой страницы
// (Недельная лига/Дуэль/Мой путь и т.д.) — референсный CSS-сниппет
// (.week-row: только flex+justify-between+margin-top) описывает внутренний
// ряд точек, не сам факт карточки-обёртки; без неё это был бы единственный
// голый, без фона элемент на очень card-центричной странице.
export default function WeekActivityRow({ activeDays }: { activeDays: boolean[] }) {
  const activeCount = activeDays.filter(Boolean).length;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div
        className="flex justify-between"
        role="img"
        aria-label={`Активность за неделю: ${activeCount} из 7 дней`}
      >
        {WEEKDAYS.map((day, i) => (
          <div key={day.short} className="flex flex-col items-center gap-[5px]">
            <span
              aria-hidden="true"
              title={`${day.full}: ${activeDays[i] ? "была активность" : "без активности"}`}
              className={`h-[22px] w-[22px] rounded-full ${
                activeDays[i] ? "bg-[var(--color-forest-light)]" : "bg-[var(--border)]"
              }`}
            />
            <span className="text-[8.5px] text-[var(--text-secondary)]">{day.short}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
