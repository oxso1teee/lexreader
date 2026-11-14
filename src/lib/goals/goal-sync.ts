import { goalProgressFor, type DailyGoalProgress } from "../dashboard/goal.ts";
import { minutesHintForGoal } from "../daily-goal.ts";
import type { GoalDoneTarget } from "../moments/types.ts";
import { userClock } from "../user-day.ts";
import type { DailyActivity } from "./activity.ts";
import { resolveGoalConfig, type DailyGoalType, type GoalProfileFields } from "./config.ts";

// «Цель дня выполнена» (activity_days.goal_met) по ВЫБРАННОМУ типу цели.
//
// Для цели в XP отметку ставит сам award_xp — в той же транзакции, что и начисление.
// Для остальных типов (уроки, упражнения, чтение, слова) прогресс складывается из
// действий, которые XP не меняют, поэтому после урока, чтения или оценки карточки
// серверный код вызывает syncGoalProgress(): считает прогресс по фактам и, если цель
// достигнута, переводит день в «выполнено» атомарно (mark_goal_met в БД возвращает true
// ровно одному вызову). От отметки зависят идеальная неделя, достижения и момент
// «Цель дня выполнена!».

export interface GoalSyncProfile extends GoalProfileFields {
  timezone: string | null;
  target_language: string;
}

export interface GoalSyncPorts {
  loadProfile(userId: string): Promise<GoalSyncProfile | null>;
  /** Уже ли день отмечен как выполненный (дешёвая проверка, чтобы не считать прогресс заново). */
  isGoalMet(userId: string, day: string): Promise<boolean>;
  loadActivity(userId: string, day: string, language: string, timezone: string): Promise<DailyActivity>;
  /** true — отметку поставил именно этот вызов. */
  markGoalMet(userId: string, day: string): Promise<boolean>;
}

export interface GoalSyncResult {
  day: string;
  goalType: DailyGoalType;
  /** null — прогресс не считался (цель в XP или день уже отмечен). */
  progress: DailyGoalProgress | null;
  /** Этот вызов перевёл день в «выполнено» — пора показать момент. */
  justCompleted: boolean;
}

export interface GoalSyncOptions {
  now?: Date;
  /** Считать и цель в XP: нужно после смены цели («уроки» → «XP», день уже набран).
   *  Из потока начисления XP не нужно — award_xp ставит отметку сам. */
  includeXp?: boolean;
}

export async function syncGoalProgress(
  ports: GoalSyncPorts,
  userId: string,
  options: GoalSyncOptions = {},
): Promise<GoalSyncResult | null> {
  const profile = await ports.loadProfile(userId);
  if (!profile) return null;
  const config = resolveGoalConfig(profile);
  const clock = userClock(profile.timezone, options.now ?? new Date());
  const idle = (): GoalSyncResult => ({ day: clock.today, goalType: config.type, progress: null, justCompleted: false });

  if (config.type === "xp" && !options.includeXp) return idle();
  if (await ports.isGoalMet(userId, clock.today)) return idle();

  const activity = await ports.loadActivity(userId, clock.today, profile.target_language, clock.timezone);
  const xpGoal = profile.daily_xp_goal ?? 0;
  const progress = goalProgressFor(config, activity, xpGoal);
  if (!progress.done) return { day: clock.today, goalType: config.type, progress, justCompleted: false };

  const flipped = await ports.markGoalMet(userId, clock.today);
  return { day: clock.today, goalType: config.type, progress, justCompleted: flipped };
}

/** Данные для collectMoments: только когда цель не в XP и именно этот вызов её закрыл. */
export function goalDoneInfo(
  result: GoalSyncResult | null,
): { goal: GoalDoneTarget; xpToday: number; xpGoal: number; minutesHint: number } | null {
  if (!result || !result.justCompleted || !result.progress || result.goalType === "xp") return null;
  const p = result.progress;
  return {
    goal: { type: p.type, current: p.current, target: p.target, unit: p.unitMany, label: p.tileLabel },
    xpToday: p.xpToday,
    xpGoal: p.xpGoal,
    minutesHint: minutesHintForGoal(p.xpGoal),
  };
}
