import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart as isoWeekStartDate } from "./iso-week.ts";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// src/lib/iso-week.ts — общая точка правды для "начало ISO-недели"
// (понедельник); здесь нужен именно date-only срез (streak_freeze_week —
// date-колонка), остальные потребители берут полный ISO-timestamp.
function isoWeekStart(d: Date): string {
  return isoDate(isoWeekStartDate(d));
}

export interface StreakTransition {
  before: number;
  after: number;
}

// docs/moments/ROADMAP.md, этап 1: возвращает before/after streak_current
// (а не void) — Streak-up-момент срабатывает ровно на росте серии, и только
// вызывающий код (reviewWord/finishReading) знает, что это первое касание
// серии за сегодня, а не повторный вызов в той же сессии (last_active_date
// уже сегодня -> ранний return ниже -> before===after, что уже нормально
// обрабатывается collectMoments как "без изменений").
export async function touchStreak(supabase: SupabaseServerClient, userId: string): Promise<StreakTransition | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "streak_current, streak_longest, last_active_date, streak_freeze_available, streak_freeze_week",
    )
    .eq("id", userId)
    .single();
  if (!profile) return null;

  const today = isoDate(new Date());
  if (profile.last_active_date === today) return { before: profile.streak_current, after: profile.streak_current };

  const thisWeekStart = isoWeekStart(new Date());
  // Заморозка "перезаряжается" в начале каждой новой ISO-недели.
  const freezeAvailable =
    profile.streak_freeze_week !== thisWeekStart ? true : profile.streak_freeze_available;

  const yesterday = isoDate(new Date(Date.now() - 86_400_000));
  const twoDaysAgo = isoDate(new Date(Date.now() - 2 * 86_400_000));

  // docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 5.1: пропуск РОВНО
  // одного дня при доступной заморозке на этой неделе — не сбрасываем серию,
  // а тратим заморозку и продолжаем как обычно.
  if (profile.last_active_date === twoDaysAgo && freezeAvailable) {
    const newStreak = profile.streak_current + 1;
    await supabase
      .from("profiles")
      .update({
        streak_current: newStreak,
        streak_longest: Math.max(newStreak, profile.streak_longest),
        last_active_date: today,
        streak_freeze_available: false,
        streak_freeze_week: thisWeekStart,
      })
      .eq("id", userId);
    return { before: profile.streak_current, after: newStreak };
  }

  const newStreak = profile.last_active_date === yesterday ? profile.streak_current + 1 : 1;

  await supabase
    .from("profiles")
    .update({
      streak_current: newStreak,
      streak_longest: Math.max(newStreak, profile.streak_longest),
      last_active_date: today,
      // Если заморозка "перезарядилась" сменой недели, но не была потрачена
      // в этом вызове — зафиксировать новую неделю, чтобы флаг не протухал.
      ...(profile.streak_freeze_week !== thisWeekStart
        ? { streak_freeze_available: true, streak_freeze_week: thisWeekStart }
        : {}),
    })
    .eq("id", userId);
  return { before: profile.streak_current, after: newStreak };
}
