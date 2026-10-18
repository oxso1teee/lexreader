import type { Moment, WeekdayMark } from "./types.ts";
import { levelForXp, xpForLevel } from "../level.ts";
import { STREAK_MILESTONES } from "../streak-engine.ts";

// docs/moments/ROADMAP.md, этап 1 — чистая функция "что из этого набора
// before/after-снимков стало Moment-ом". Не трогает Supabase сама: вызывающий
// код (reviewWord/finishReading) собирает снимки до/после своих же реальных
// записей (addXp/touchStreak/checkAndAwardAchievements/
// recomputeAndPersistLearningState) и передаёт их сюда.

export interface XpCheckpoint {
  total: number;
  /** Сумма activity_days.xp за сегодня (UTC). */
  today: number;
}

export interface CollectMomentsInput {
  /** null — addXp не вызывался в этом действии (нет XP-события). */
  xp: { before: XpCheckpoint; after: XpCheckpoint; goal: number; minutesHint: number } | null;
  /** null — touchStreak не вызывался / не нашёл профиль. */
  streak: {
    before: number;
    after: number;
    usedFreeze: boolean;
    repairStarted: boolean;
    milestonesCrossed: readonly number[];
    /** Заполнено только когда repairStarted. */
    streakBeforeBreak: number | null;
  } | null;
  /** Пн..Вс текущей ISO-недели по activity_days.goal_met — для Goal-done. */
  goalWeek: WeekdayMark[];
  /** Пн..Вс по реальной активности + freeze_used (а не по цели дня) — для
   *  Streak-up/Freeze-used: серию двигает любое занятие, не только то, что
   *  добралось до цели в XP. */
  streakWeek: WeekdayMark[];
  /** achievement_id новых (не ранее полученных) достижений, в порядке получения. */
  newAchievementIds: readonly string[];
  /** null — recomputeAndPersistLearningState не вызывался в этом действии. */
  wordMastered: {
    before: string;
    after: string;
    flashcardId: string;
    front: string;
    back: string;
    timesSeen: number;
    timesCorrect: number;
    totalMastered: number;
  } | null;
  /** UTC-дата события ("2026-10-17") — часть id у goal_done/streak_up, чтобы
   *  момент не повторялся за тот же день при нескольких действиях подряд. */
  today: string;
}

export function collectMoments(input: CollectMomentsInput): Moment[] {
  const moments: Moment[] = [];

  if (input.xp) {
    const { before, after, goal, minutesHint } = input.xp;
    if (before.today < goal && after.today >= goal) {
      moments.push({
        kind: "goal_done",
        id: `goal_done:${input.today}`,
        xpToday: after.today,
        xpGoal: goal,
        minutesHint,
        week: input.goalWeek,
      });
    }

    const levelBefore = levelForXp(before.total);
    const levelAfter = levelForXp(after.total);
    if (levelAfter > levelBefore) {
      moments.push({
        kind: "level_up",
        id: `level_up:${levelAfter}`,
        level: levelAfter,
        totalXp: after.total,
        xpIntoLevel: after.total - xpForLevel(levelAfter),
        xpForNextLevel: xpForLevel(levelAfter + 1) - xpForLevel(levelAfter),
      });
    }
  }

  // docs/moments/ROADMAP.md, этап 2 — streak_up/freeze_used/earn_back
  // взаимоисключающие: один и тот же "рост серии" объясняется ровно одной
  // историей. Earn-back показывается на САМОМ обрыве (repairStarted),
  // Freeze-used — когда выручила заморозка, иначе (включая успешное
  // восстановление — у него своего экрана нет) обычный streak_up.
  if (input.streak) {
    const s = input.streak;
    if (s.repairStarted) {
      moments.push({ kind: "earn_back", id: `earn_back:${input.today}`, streakBeforeBreak: s.streakBeforeBreak as number });
    } else if (s.usedFreeze) {
      moments.push({ kind: "freeze_used", id: `freeze_used:${input.today}`, streak: s.after, week: input.streakWeek });
    } else if (s.after > s.before) {
      moments.push({ kind: "streak_up", id: `streak_up:${input.today}`, streak: s.after, week: input.streakWeek });
    }

    for (const milestone of s.milestonesCrossed) {
      const nextMilestone = STREAK_MILESTONES.find((m) => m > milestone) ?? null;
      moments.push({ kind: "streak_milestone", id: `streak_milestone:${milestone}`, milestone, nextMilestone });
    }
  }

  for (const achievementId of input.newAchievementIds) {
    moments.push({ kind: "achievement", id: `achievement:${achievementId}`, achievementId });
  }

  if (input.wordMastered && input.wordMastered.before !== "maintenance" && input.wordMastered.after === "maintenance") {
    const wm = input.wordMastered;
    moments.push({
      kind: "word_mastered",
      id: `word_mastered:${wm.flashcardId}`,
      front: wm.front,
      back: wm.back,
      timesSeen: wm.timesSeen,
      timesCorrect: wm.timesCorrect,
      totalMastered: wm.totalMastered,
    });
  }

  return moments;
}
