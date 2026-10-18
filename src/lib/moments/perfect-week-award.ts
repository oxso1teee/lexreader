import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart } from "@/lib/iso-week";
import { addXp, todayUtcIso } from "@/lib/xp-actions";
import { minutesHintForGoal } from "@/lib/daily-goal";
import { isPerfectWeek } from "./perfect-week";
import { collectMoments } from "./collect";
import { fetchGoalWeekMarks } from "./week-query";
import type { Moment } from "./types";

// docs/moments/mockups/Perfect-week.dc.html — "+20 XP за идеальную неделю",
// один раз в неделю (profiles.perfect_week_awarded_week — сторож).
const PERFECT_WEEK_BONUS_XP = 20;

function isoDateDays(base: Date, days: number): string {
  const d = new Date(base.getTime() + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

// Вызывается из тех же точек, что touchStreak/addXp (reviewWord/
// finishReading) — сама не бросает исключений, фоновая проверка не должна
// ломать основное действие.
export async function awardPerfectWeekIfEligible(supabase: SupabaseServerClient, userId: string): Promise<{ moments: Moment[] }> {
  try {
    const now = new Date();
    const monday = isoWeekStart(now);
    const mondayIso = monday.toISOString().slice(0, 10);

    const { data: profile } = await supabase
      .from("profiles")
      .select("perfect_week_awarded_week")
      .eq("id", userId)
      .single();
    if (!profile || profile.perfect_week_awarded_week === mondayIso) return { moments: [] };

    const sundayIso = isoDateDays(monday, 6);
    const { data: rows } = await supabase
      .from("activity_days")
      .select("day, goal_met, freeze_used")
      .eq("user_id", userId)
      .gte("day", mondayIso)
      .lte("day", sundayIso);

    const byDay = new Map((rows ?? []).map((r) => [r.day as string, r]));
    const days = Array.from({ length: 7 }, (_, i) => {
      const row = byDay.get(isoDateDays(monday, i));
      return { goalMet: row?.goal_met ?? false, freezeUsed: row?.freeze_used ?? false };
    });
    if (!isPerfectWeek(days)) return { moments: [] };

    const [xpResult] = await Promise.all([
      addXp(supabase, userId, PERFECT_WEEK_BONUS_XP),
      supabase.from("profiles").update({ perfect_week_awarded_week: mondayIso }).eq("id", userId),
    ]);
    if (!xpResult) return { moments: [] };

    const goalWeek = await fetchGoalWeekMarks(supabase, userId, now);
    const extraMoments = collectMoments({
      xp: {
        before: { total: xpResult.total.before, today: xpResult.today.before },
        after: { total: xpResult.total.after, today: xpResult.today.after },
        goal: xpResult.goal,
        minutesHint: minutesHintForGoal(xpResult.goal),
      },
      streak: null,
      goalWeek,
      streakWeek: [],
      newAchievementIds: [],
      wordMastered: null,
      today: todayUtcIso(),
    });

    return {
      moments: [{ kind: "perfect_week", id: `perfect_week:${mondayIso}`, xpAwarded: PERFECT_WEEK_BONUS_XP }, ...extraMoments],
    };
  } catch {
    return { moments: [] };
  }
}
