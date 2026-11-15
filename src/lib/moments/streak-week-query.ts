import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart } from "@/lib/iso-week";
import { getUserClock } from "@/lib/user-clock-server";
import { streakWeekMarks } from "./streak-week";
import type { WeekdayMark } from "./types";

// `now` — «настенные часы» пользователя (UserClock.wall): неделя и дни считаются по
// UTC-полям этой даты. Не передан — пояс берётся из профиля, как и у остальных
// «дневных» метрик (src/lib/user-day.ts).
export async function fetchStreakWeekMarks(
  supabase: SupabaseServerClient,
  userId: string,
  now?: Date,
): Promise<WeekdayMark[]> {
  now ??= (await getUserClock(supabase, userId)).wall;
  const monday = isoWeekStart(now).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("activity_days")
    .select("day, xp, freeze_used")
    .eq("user_id", userId)
    .gte("day", monday);
  const active = (data ?? []).filter((d) => (d.xp as number) > 0).map((d) => d.day as string);
  const freeze = (data ?? []).filter((d) => d.freeze_used as boolean).map((d) => d.day as string);
  return streakWeekMarks(active, freeze, now);
}
