import type { Moment } from "./types.ts";

// Тестовые данные для галереи /dev/moments и скриншот-сверки с макетами v7.
// Значения совпадают с docs/moments/reference/*.png.
export const MOMENT_FIXTURES: Record<string, Moment> = {
  "Goal-done": {
    kind: "goal_done",
    id: "fixture-goal-done",
    xpToday: 50,
    xpGoal: 50,
    minutesHint: 10,
    week: ["done", "done", "done", "today", "empty", "empty", "empty"],
  },
  "Streak-up": {
    kind: "streak_up",
    id: "fixture-streak-up",
    streak: 13,
    week: ["done", "done", "done", "today", "empty", "empty", "empty"],
    friend: { name: "Аня", initial: "А", sharedStreak: 9 },
  },
  Perfect: {
    kind: "perfect",
    id: "fixture-perfect",
    cardCount: 12,
    durationSec: 192,
    bonusXp: 10,
  },
  "Level-up": {
    kind: "level_up",
    id: "fixture-level-up",
    level: 8,
    totalXp: 1500,
    xpIntoLevel: 40,
    xpForNextLevel: 100,
  },
  Achievement: {
    kind: "achievement",
    id: "fixture-achievement",
    achievementId: "first_book",
  },
  "Word-mastered": {
    kind: "word_mastered",
    id: "fixture-word-mastered",
    front: "reluctant",
    back: "неохотный",
    timesSeen: 7,
    timesCorrect: 5,
    totalMastered: 843,
  },
  "Streak-30": {
    kind: "streak_milestone",
    id: "fixture-streak-30",
    milestone: 30,
    nextMilestone: 50,
  },
  "Freeze-used": {
    kind: "freeze_used",
    id: "fixture-freeze-used",
    streak: 12,
    week: ["done", "done", "freeze", "today", "empty", "empty", "empty"],
  },
  "Perfect-week": {
    kind: "perfect_week",
    id: "fixture-perfect-week",
    xpAwarded: 20,
  },
  "Earn-back": {
    kind: "earn_back",
    id: "fixture-earn-back",
    streakBeforeBreak: 12,
  },
};
