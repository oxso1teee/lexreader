import { isoWeekStart } from "../iso-week.ts";
import type { WeekdayMark } from "./types.ts";

// Freeze-used/Streak-30/Today-evening — неделя по РЕАЛЬНОЙ активности
// (activity_days.xp > 0), не по "цель дня выполнена" (goalWeekMarks,
// week.ts): серию двигает любое занятие, независимо от того, добрался ли
// день до цели в XP. freeze-дни отмечены отдельно (activity_days.freeze_used,
// пишется в touchStreak при спасении пропуска).
export function streakWeekMarks(
  activeDates: Iterable<string>,
  freezeDates: Iterable<string>,
  now: Date = new Date(),
): WeekdayMark[] {
  const active = new Set(activeDates);
  const freeze = new Set(freezeDates);
  const monday = isoWeekStart(now);
  const todayIso = now.toISOString().slice(0, 10);
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday.getTime() + i * 86_400_000).toISOString().slice(0, 10);
    if (freeze.has(day)) return "freeze";
    if (active.has(day)) return "done";
    if (day === todayIso) return "today";
    return "empty";
  });
}
