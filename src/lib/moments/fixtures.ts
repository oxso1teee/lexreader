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
};
