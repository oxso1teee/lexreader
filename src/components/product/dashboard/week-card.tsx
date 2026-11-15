import { Snowflake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FlameIcon } from "@/components/product/today/v7/icons";
import { WEEKDAY_LONG, WEEKDAY_SHORT, weekDoneCount } from "@/lib/dashboard/week";
import type { WeekdayMark } from "@/lib/moments/types";

const MARK_TEXT: Record<WeekdayMark, string> = {
  done: "были занятия",
  today: "сегодня, занятий пока нет",
  empty: "занятий не было",
  freeze: "заморозка сохранила серию",
};

// Карточка «Неделя»: Пн–Вс текущей ISO-недели по реальной активности
// (activity_days) и заморозкам. Цвет не единственный носитель смысла: у
// каждого дня есть скрытая подпись для скринридера.
export default function WeekCard({
  marks,
  todayIndex,
  note,
}: {
  marks: WeekdayMark[];
  todayIndex: number;
  note: string | null;
}) {
  const done = weekDoneCount(marks);
  return (
    <Card as="section" aria-labelledby="dash-week-title">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="dash-week-title" className="m-0 text-[0.9375rem] font-bold">
          Неделя
        </h2>
        {note && <span className="text-[0.8125rem] font-semibold text-[var(--ember-text)]">{note}</span>}
      </div>
      <ol className="dash-week" aria-label={`Дни недели, занятий: ${done} из 7`}>
        {marks.map((mark, i) => (
          <li key={i}>
            <div className="dash-day" data-mark={mark} aria-hidden="true">
              {mark === "done" && <FlameIcon size={18} fill="#fff" inner={null} />}
              {mark === "freeze" && <Snowflake className="h-4 w-4" />}
            </div>
            <span className="sr-only">
              {WEEKDAY_LONG[i]}: {MARK_TEXT[mark]}
            </span>
            <div className="dash-day-label" data-today={i === todayIndex ? "true" : undefined} aria-hidden="true">
              {WEEKDAY_SHORT[i]}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
