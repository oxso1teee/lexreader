import { isoWeekStart } from "./iso-week.ts";

export type DayMark = "done" | "today" | "missed" | "future";

// Пн..Вс текущей ISO-недели (UTC, как остальные даты активности в
// приложении): был ли в этот день хоть один сеанс чтения или повтор.
// Сегодня без активности — "today" (пунктир), будущие дни — "future".
export function weekMarks(activeDates: Iterable<string>, now: Date = new Date()): DayMark[] {
  const active = new Set(activeDates);
  const monday = isoWeekStart(now);
  const todayIso = now.toISOString().slice(0, 10);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    if (active.has(day)) return "done";
    if (day === todayIso) return "today";
    return day > todayIso ? "future" : "missed";
  });
}
