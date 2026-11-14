import { DEFAULT_DAILY_XP_GOAL, minutesHintForGoal } from "../daily-goal.ts";

// Прогресс цели дня на главном экране. Чистая функция: XP за сегодня
// (activity_days.xp, день по UTC — как и вся остальная активность в проекте)
// против profiles.daily_xp_goal. Всё, что рисуют кольцо, полоса и подписи
// («Ещё 20 XP до цели»), считается здесь один раз, а не в каждой карточке.
export interface DailyGoalProgress {
  xpToday: number;
  xpGoal: number;
  /** Доля 0..1 — для кольца и полосы. */
  value: number;
  /** Целый процент 0..100 — для подписей. */
  percent: number;
  /** Сколько XP осталось до цели; 0, когда цель выполнена. */
  remaining: number;
  done: boolean;
  /** Ориентир «~N мин» для всей цели (сама цель хранится и сравнивается только в XP). */
  goalMinutes: number;
}

function wholeCount(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export function dailyGoalProgress(xpToday: number, xpGoal: number): DailyGoalProgress {
  const today = wholeCount(xpToday);
  // daily_xp_goal в БД > 0 (check), но пустое или битое значение не должно
  // давать деление на ноль — берём цель по умолчанию, как и онбординг.
  const goal = wholeCount(xpGoal) || DEFAULT_DAILY_XP_GOAL;
  const value = Math.min(1, today / goal);
  return {
    xpToday: today,
    xpGoal: goal,
    value,
    percent: Math.round(value * 100),
    remaining: Math.max(0, goal - today),
    done: today >= goal,
    goalMinutes: minutesHintForGoal(goal),
  };
}
