import type { SupabaseServerClient } from "./supabase/server.ts";
import { log } from "./log.ts";

export function todayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}

export interface AddXpResult {
  total: { before: number; after: number };
  /** activity_days.xp за сегодня (UTC) — цель дня (ROADMAP, этап 1) считается по этому полю, не по total. */
  today: { before: number; after: number };
  goal: number;
  /** docs/moments/mockups/Double-XP.dc.html — реально начисленная сумма
   *  (после умножения ×2, если буст активен) — ВСЕГДА используй это поле
   *  для "+N XP" в UI, не входной `amount` вызова addXp(): при активном
   *  бусте они расходятся. */
  awarded: number;
  /** true — этот конкретный вызов был удвоен активным Double-XP. */
  boosted: boolean;
}

// Раздел 5 промта 2026-07-30 (полировка): та же самая точка входа что и
// checkAndAwardAchievements — вызывается из тех же чекпоинтов прогресса,
// сама не бросает исключений наружу.
//
// docs/moments/ROADMAP.md, этап 1: теперь также пишет activity_days за
// сегодня (для Goal-done/недели в Streak-up) и возвращает before/after —
// collectMoments() решает по ним, не проверено ли что-то здесь само.
// Как и раньше (profiles.xp), не атомарно (select, затем write) — тот же
// принятый в проекте компромисс, не новый; оба обновления независимы, так
// что гонка задвоит максимум один из двух счётчиков, никогда не потеряет XP.
export async function addXp(supabase: SupabaseServerClient, ownerId: string, amount: number): Promise<AddXpResult | null> {
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("xp, daily_xp_goal, xp_boost_until")
      .eq("id", ownerId)
      .single();
    if (!profile) return null;

    // docs/moments/mockups/Double-XP.dc.html — удваиваем каждое начисление,
    // пока активен буст, а не только "занятия целиком": тот же addXp()
    // вызывается и за отдельное слово/карточку, и за бонусы — единая точка,
    // как и у остальной XP-логики в этом файле.
    const boosted = !!profile.xp_boost_until && new Date(profile.xp_boost_until) > new Date();
    const awarded = boosted ? amount * 2 : amount;

    const today = todayUtcIso();
    const { data: existingDay } = await supabase
      .from("activity_days")
      .select("xp")
      .eq("user_id", ownerId)
      .eq("day", today)
      .maybeSingle();

    const xpTodayBefore = existingDay?.xp ?? 0;
    const xpTodayAfter = xpTodayBefore + awarded;
    const xpTotalBefore = profile.xp;
    const xpTotalAfter = xpTotalBefore + awarded;

    await Promise.all([
      supabase.from("profiles").update({ xp: xpTotalAfter }).eq("id", ownerId),
      supabase.from("activity_days").upsert(
        {
          user_id: ownerId,
          day: today,
          xp: xpTodayAfter,
          goal_met: xpTodayAfter >= profile.daily_xp_goal,
        },
        { onConflict: "user_id,day" },
      ),
    ]);

    return {
      total: { before: xpTotalBefore, after: xpTotalAfter },
      today: { before: xpTodayBefore, after: xpTodayAfter },
      goal: profile.daily_xp_goal,
      awarded,
      boosted,
    };
  } catch (e) {
    log.error({ kind: "xp_update", message: e instanceof Error ? e.message : "unknown" });
    return null;
  }
}
