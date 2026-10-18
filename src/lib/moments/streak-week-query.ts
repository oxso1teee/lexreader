import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart } from "@/lib/iso-week";
import { streakWeekMarks } from "./streak-week";
import type { WeekdayMark } from "./types";

export async function fetchStreakWeekMarks(
  supabase: SupabaseServerClient,
  userId: string,
  now: Date = new Date(),
): Promise<WeekdayMark[]> {
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
