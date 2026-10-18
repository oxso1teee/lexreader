import { weekMarks } from "../week-marks.ts";
import type { WeekdayMark } from "./types.ts";

// Goal-done/Streak-up (docs/moments/mockups) только различают
// done/today/пусто — weekMarks()'s "missed"/"future" обе схлопываются в
// "empty" (moments/types.ts's WeekdayMark тоже даёт "freeze" для будущих
// экранов стрика, этап 2 — здесь не используется).
export function goalWeekMarks(goalMetDates: Iterable<string>, now: Date = new Date()): WeekdayMark[] {
  return weekMarks(goalMetDates, now).map((d) => (d === "done" || d === "today" ? d : "empty"));
}
