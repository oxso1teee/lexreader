import { DEFAULT_DAILY_XP_GOAL, minutesHintForGoal } from "../daily-goal.ts";
import type { DailyActivity } from "../goals/activity.ts";
import { GOAL_TYPE_DEFS, formatGoalAmount, type DailyGoalConfig, type DailyGoalType } from "../goals/config.ts";

// Прогресс цели дня на главном экране. Чистая функция: активность за локальный
// день пользователя (goals/activity.ts) против выбранной цели (goals/config.ts):
// по умолчанию XP против profiles.daily_xp_goal, либо уроки, упражнения, минуты
// чтения, слова. Всё, что рисуют кольцо, полоса и подписи («Ещё 20 XP до цели»),
// считается здесь один раз, а не в каждой карточке.
export interface DailyGoalProgress {
  /** XP за сегодня и цель в XP — относятся к XP-метрике дня независимо от выбранного типа цели. */
  xpToday: number;
  xpGoal: number;
  /** Выбранная цель дня и прогресс по ней (в её единицах). Для типа «xp» совпадает с xpToday/xpGoal. */
  type: DailyGoalType;
  current: number;
  target: number;
  /** Единица после числа цели, в согласовании с ним («XP», «мин», «2 урока» → «урока»). */
  unit: string;
  /** Единица для оборота «N из M …» (родительный множественного: «уроков», «слов»). */
  unitMany: string;
  /** Остаток с правильной формой единицы: «1 урок», «8 слов», «6 мин». */
  remainingLabel: string;
  /** Подпись под числом на плитке: «XP сегодня», «уроков сегодня». */
  tileLabel: string;
  // Дальше — всё про ВЫБРАННУЮ цель (value / percent / remaining / done).
  /** Доля 0..1 — для кольца и полосы. */
  value: number;
  /** Целый процент 0..100 — для подписей. */
  percent: number;
  /** Сколько единиц цели осталось; 0, когда цель выполнена. */
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
  return goalProgressFor({ type: "xp", target: goal }, { xp: today, readingMinutes: 0, reviewedWords: 0, lessons: 0, exercises: 0 }, goal);
}

type ActivityForGoal = Pick<DailyActivity, "xp" | "readingMinutes" | "reviewedWords" | "lessons" | "exercises">;

/** Сколько «единиц» выбранной цели набрано за день. */
export function goalCurrent(type: DailyGoalType, activity: ActivityForGoal): number {
  switch (type) {
    case "xp":
      return activity.xp;
    case "lessons":
      return activity.lessons;
    case "exercises":
      return activity.exercises;
    case "reading_minutes":
      return activity.readingMinutes;
    case "words":
      return activity.reviewedWords;
  }
}

/** Прогресс выбранной цели дня по реальной активности. xpGoal — XP-цель профиля
 *  (для ориентира «~N мин» и неизменных полей xpToday/xpGoal). */
export function goalProgressFor(config: DailyGoalConfig, activity: ActivityForGoal, xpGoal: number): DailyGoalProgress {
  const current = wholeCount(goalCurrent(config.type, activity));
  const target = wholeCount(config.target) || GOAL_TYPE_DEFS[config.type].defaultTarget;
  const value = Math.min(1, current / target);
  const xpGoalSafe = wholeCount(xpGoal) || DEFAULT_DAILY_XP_GOAL;
  return {
    xpToday: wholeCount(activity.xp),
    xpGoal: xpGoalSafe,
    type: config.type,
    current,
    target,
    unit: GOAL_TYPE_DEFS[config.type].unit(target),
    unitMany: GOAL_TYPE_DEFS[config.type].unit(5),
    remainingLabel: formatGoalAmount(config.type, Math.max(0, target - current)),
    tileLabel: GOAL_TYPE_DEFS[config.type].tileLabel,
    value,
    percent: Math.round(value * 100),
    remaining: Math.max(0, target - current),
    done: current >= target,
    goalMinutes: minutesHintForGoal(xpGoalSafe),
  };
}
