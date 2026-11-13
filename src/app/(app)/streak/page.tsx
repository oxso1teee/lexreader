import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { isoWeekStart } from "@/lib/iso-week";
import { StreakCalendarView } from "./streak-calendar-view";

// docs/moments/mockups/Streak-calendar.dc.html, reference/Streak-calendar.png
// — этап 2 (docs/moments/ROADMAP.md). Карточка "До сундука «Две недели»" из
// макета убрана — у приложения нет механики сундуков по рубежам серии
// (Chest появится в этапе 5), нечего показать настоящего.

function parseMonthParam(m: string | undefined): Date {
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    return new Date(Date.UTC(y, mo - 1, 1));
  }
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthParam(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function StreakCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();

  const monthStart = parseMonthParam(m);
  const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
  const todayIso = isoDate(new Date());
  const thisMonthIso = monthParam(new Date());
  const isCurrentMonth = monthParam(monthStart) === thisMonthIso;

  const { data: rows } = await supabase
    .from("activity_days")
    .select("day, xp, freeze_used")
    .eq("user_id", profile.id)
    .gte("day", isoDate(monthStart))
    .lte("day", isoDate(monthEnd));

  return (
    <StreakCalendarView
      monthStart={monthStart}
      todayIso={todayIso}
      isCurrentMonth={isCurrentMonth}
      rows={(rows ?? []).map((r) => ({ day: r.day as string, xp: r.xp as number, freeze_used: Boolean(r.freeze_used) }))}
      streakCurrent={profile.streak_current}
      streakLongest={profile.streak_longest}
      streakGoalDays={profile.streak_goal_days}
      freezeUsedThisWeek={profile.streak_freeze_week === isoDate(isoWeekStart(new Date())) && !profile.streak_freeze_available}
    />
  );
}
