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

// Этап 1 (docs/moments/ROADMAP.md) — итог занятия/чтения: без ошибок, новый
// уровень, достижение, слово выучено.
export interface PerfectMoment {
  kind: "perfect";
  id: string;
  /** Карточек в сессии — все с первой попытки (grade 2 или 3). */
  cardCount: number;
  durationSec: number;
  /** Реально начисленный бонус (addXp), не декоративное число. */
  bonusXp: number;
}

export interface LevelUpMoment {
  kind: "level_up";
  id: string;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
}

// achievementId — ключ в src/lib/achievements.ts ACHIEVEMENTS; экран сам
// смотрит там title/description/icon, а не дублирует их здесь — один
// источник правды, та же схема, что у AchievementsShelf.
export interface AchievementMoment {
  kind: "achievement";
  id: string;
  achievementId: string;
}

export interface WordMasteredMoment {
  kind: "word_mastered";
  id: string;
  front: string;
  back: string;
  /** Всего ревью этой карточки (review_log). */
  timesSeen: number;
  /** Из них с оценкой "Помню"/"Легко". */
  timesCorrect: number;
  /** Сколько слов этого языка у пользователя сейчас в learning_state="maintenance". */
  totalMastered: number;
}

export type Moment =
  | GoalDoneMoment
  | StreakUpMoment
  | PerfectMoment
  | LevelUpMoment
  | AchievementMoment
  | WordMasteredMoment;
export type MomentKind = Moment["kind"];

// Порядок показа после занятия (ROADMAP, этап 1): Result (не момент — сам
// экран итога) → Perfect → Goal-done → Streak-up → Level-up/Achievement →
// Word-mastered. Чем выше число, тем раньше показываем.
export const MOMENT_PRIORITY: Record<MomentKind, number> = {
  perfect: 60,
  goal_done: 50,
  streak_up: 40,
  level_up: 30,
  achievement: 30,
  word_mastered: 20,
};

/** Больше подряд не показываем — остальные подождут следующего действия. */
export const MAX_MOMENTS_IN_A_ROW = 3;
