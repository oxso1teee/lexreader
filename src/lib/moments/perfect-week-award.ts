import type { SupabaseServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { awardXp, toAddXpResult } from "@/lib/xp/award";
import { getUserClock } from "@/lib/user-clock-server";
import { addDays } from "@/lib/user-day";
import { minutesHintForGoal } from "@/lib/daily-goal";
import { isPerfectWeek } from "./perfect-week";
import { collectMoments } from "./collect";
import { fetchGoalWeekMarks } from "./week-query";
import type { Moment } from "./types";

// docs/moments/mockups/Perfect-week.dc.html — «+20 XP за идеальную неделю»,
// один раз в неделю. Размер — в каталоге источников XP (perfect_week).
//
// Идемпотентность — ключ «понедельник недели» в журнале XP (xp_events): раньше
// проверка profiles.perfect_week_awarded_week и запись XP шли независимо, и две
// параллельные оценки карточек могли обе увидеть «ещё не выдано» и обе начислить
// +20. Колонка осталась как дешёвый ранний выход (чтобы не читать неделю на
// каждой карточке), но решает ключ в журнале.
const PERFECT_WEEK_REF_PREFIX = "week:";

// Отметка недели — поле профиля, закрытое для клиентской роли (миграция 0060): пишем сервисной.
// userId — из серверной сессии вызывающего. Это лишь ранний выход; решает ключ в журнале XP.
async function markPerfectWeekAwarded(userId: string, mondayIso: string): Promise<void> {
  await createServiceClient().from("profiles").update({ perfect_week_awarded_week: mondayIso }).eq("id", userId);
}

// Вызывается из тех же точек, что touchStreak/awardXp (reviewWord/
// finishReading) — сама не бросает исключений, фоновая проверка не должна
// ломать основное действие.
export async function awardPerfectWeekIfEligible(supabase: SupabaseServerClient, userId: string): Promise<{ moments: Moment[] }> {
  try {
    // Неделя — по календарю пользователя.
    const clock = await getUserClock(supabase, userId);
    const mondayIso = clock.weekStart;

    const { data: profile } = await supabase
      .from("profiles")
      .select("perfect_week_awarded_week")
      .eq("id", userId)
      .single();
    if (!profile || profile.perfect_week_awarded_week === mondayIso) return { moments: [] };

    const { data: rows } = await supabase
      .from("activity_days")
      .select("day, goal_met, freeze_used")
      .eq("user_id", userId)
      .gte("day", mondayIso)
      .lte("day", addDays(mondayIso, 6));

    const byDay = new Map((rows ?? []).map((r) => [r.day as string, r]));
    const days = Array.from({ length: 7 }, (_, i) => {
      const row = byDay.get(addDays(mondayIso, i));
      return { goalMet: row?.goal_met ?? false, freezeUsed: row?.freeze_used ?? false };
    });
    if (!isPerfectWeek(days)) return { moments: [] };

    const outcome = await awardXp(userId, { source: "perfect_week", ref: `${PERFECT_WEEK_REF_PREFIX}${mondayIso}` });
    if (outcome.status === "duplicate") {
      // Уже начислено (например, параллельным вызовом): только выровнять ранний выход.
      await markPerfectWeekAwarded(userId, mondayIso);
      return { moments: [] };
    }
    const xpResult = toAddXpResult(outcome);
    if (!xpResult) return { moments: [] };
    await markPerfectWeekAwarded(userId, mondayIso);

    const goalWeek = await fetchGoalWeekMarks(supabase, userId, clock.now);
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
      today: xpResult.day,
    });

    return {
      moments: [{ kind: "perfect_week", id: `perfect_week:${mondayIso}`, xpAwarded: xpResult.awarded }, ...extraMoments],
    };
  } catch {
    return { moments: [] };
  }
}
