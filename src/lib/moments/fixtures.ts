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
  Overtaken: {
    kind: "overtaken",
    id: "fixture-overtaken",
    friendName: "Макс",
    friendInitial: "М",
    theirRank: 4,
    xpGapToReclaim: 20,
  },
  "Weekly-rank": {
    kind: "weekly_rank",
    id: "fixture-weekly-rank",
    weekLabel: "13–19 окт",
    myRank: 4,
    myScore: 310,
    xpGapToNextTier: 40,
    podium: [
      { rank: 2, name: "Макс", initial: "М", score: 420 },
      { rank: 1, name: "Аня", initial: "А", score: 510 },
      { rank: 3, name: "Лена", initial: "Л", score: 350 },
    ],
    rowBelow: { rank: 5, name: "Дима", initial: "Д", score: 280 },
  },
  "Friend-streak": {
    kind: "friend_streak",
    id: "fixture-friend-streak",
    sharedStreak: 10,
    friendName: "Аня",
    partners: [
      { id: "fixture-friend-anya", name: "Аня", initial: "А", personalStreak: 10 },
      { id: "fixture-friend-max", name: "Макс", initial: "М", personalStreak: 4 },
    ],
  },
};
