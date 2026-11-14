import type { WeekdayMark } from "../moments/types.ts";

// Дни ISO-недели (Пн..Вс, UTC — та же граница, что у streakWeekMarks и
// activity_days): подписи для карточки «Неделя» и номер сегодняшней колонки.
export const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const WEEKDAY_LONG = [
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
  "воскресенье",
] as const;

/** Индекс сегодняшнего дня в неделе: 0 — понедельник, 6 — воскресенье. */
export function todayColumn(now: Date = new Date()): number {
  return (now.getUTCDay() + 6) % 7;
}

/** Сколько дней недели с занятиями (замороженные дни — это спасённые пропуски, а не занятия). */
export function weekDoneCount(marks: readonly WeekdayMark[]): number {
  return marks.filter((m) => m === "done").length;
}
