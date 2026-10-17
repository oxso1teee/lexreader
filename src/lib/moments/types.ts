// docs/moments/ROADMAP.md — «момент»: полноэкранный праздничный/важный экран,
// который всплывает после действия (как в Duolingo). Сервер решает, ЧТО
// случилось, и отдаёт список моментов; клиент (MomentProvider) показывает их
// по очереди. Каждый вид — отдельная ветка union, данные — только реальные.

export type WeekdayMark = "done" | "today" | "empty" | "freeze";

export interface GoalDoneMoment {
  kind: "goal_done";
  id: string;
  xpToday: number;
  xpGoal: number;
  minutesHint: number;
  /** Пн..Вс текущей ISO-недели. */
  week: WeekdayMark[];
}

export interface StreakUpMoment {
  kind: "streak_up";
  id: string;
  streak: number;
  week: WeekdayMark[];
  /** Друг с общей серией, который сегодня ещё не занимался (необязательно). */
  friend?: { name: string; initial: string; sharedStreak: number } | null;
}

export type Moment = GoalDoneMoment | StreakUpMoment;
export type MomentKind = Moment["kind"];

/** Чем выше, тем раньше показываем. Праздник цели — до стрика (как в макете). */
export const MOMENT_PRIORITY: Record<MomentKind, number> = {
  goal_done: 50,
  streak_up: 40,
};

/** Больше подряд не показываем — остальные подождут следующего действия. */
export const MAX_MOMENTS_IN_A_ROW = 3;
