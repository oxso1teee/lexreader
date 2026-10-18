import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart } from "@/lib/iso-week";
import { goalWeekMarks } from "./week";
import type { WeekdayMark } from "./types";

// Тонкая обёртка над goalWeekMarks() (чистая функция, src/lib/moments/week.ts)
// для серверных действий — сама не тестируется отдельно (только проводит
// данные), логика "какой день = done" уже покрыта week.test.ts.
export async function fetchGoalWeekMarks(
  supabase: SupabaseServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<WeekdayMark[]> {
  const monday = isoWeekStart(now).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("activity_days")
    .select("day")
    .eq("user_id", userId)
    .eq("goal_met", true)
    .gte("day", monday);
  return goalWeekMarks((data ?? []).map((d) => d.day as string), now);
}
