import { test } from "node:test";
import assert from "node:assert/strict";
import { collectMoments, type CollectMomentsInput } from "./collect.ts";

const WEEK = ["done", "done", "done", "today", "empty", "empty", "empty"] as const;

function base(): CollectMomentsInput {
  return {
    xp: null,
    streak: null,
    goalWeek: [...WEEK],
    streakWeek: [...WEEK],
    newAchievementIds: [],
    wordMastered: null,
    today: "2026-10-17",
  };
}

function streak(before: number, after: number, overrides: Partial<NonNullable<CollectMomentsInput["streak"]>> = {}): NonNullable<CollectMomentsInput["streak"]> {
  return { before, after, usedFreeze: false, repairStarted: false, milestonesCrossed: [], streakBeforeBreak: null, ...overrides };
}

test("collectMoments(): crossing the daily XP goal produces goal_done with a stable per-day id", () => {
  const moments = collectMoments({
    ...base(),
    xp: { before: { total: 100, today: 40 }, after: { total: 110, today: 55 }, goal: 50, minutesHint: 10 },
  });
  assert.deepEqual(moments, [
    { kind: "goal_done", id: "goal_done:2026-10-17", xpToday: 55, xpGoal: 50, minutesHint: 10, week: [...WEEK] },
  ]);
});

test("collectMoments(): already past the goal before this action never re-fires goal_done", () => {
  const moments = collectMoments({
    ...base(),
    xp: { before: { total: 100, today: 60 }, after: { total: 110, today: 70 }, goal: 50, minutesHint: 10 },
  });
  assert.equal(moments.find((m) => m.kind === "goal_done"), undefined);
});

test("collectMoments(): exactly landing on the goal counts as met (>=, not >)", () => {
  const moments = collectMoments({
    ...base(),
    xp: { before: { total: 0, today: 49 }, after: { total: 1, today: 50 }, goal: 50, minutesHint: 10 },
  });
  assert.ok(moments.some((m) => m.kind === "goal_done"));
});

test("collectMoments(): crossing a level boundary produces level_up with the real progress-to-next numbers", () => {
  const moments = collectMoments({
    ...base(),
    xp: { before: { total: 790, today: 0 }, after: { total: 850, today: 0 }, goal: 999999, minutesHint: 0 },
  });
  assert.deepEqual(moments, [
    { kind: "level_up", id: "level_up:9", level: 9, totalXp: 850, xpIntoLevel: 50, xpForNextLevel: 100 },
  ]);
});

test("collectMoments(): staying within the same level never fires level_up", () => {
  const moments = collectMoments({
    ...base(),
    xp: { before: { total: 810, today: 0 }, after: { total: 850, today: 0 }, goal: 999999, minutesHint: 0 },
  });
  assert.equal(moments.find((m) => m.kind === "level_up"), undefined);
});

test("collectMoments(): streak increasing produces streak_up", () => {
  const moments = collectMoments({ ...base(), streak: streak(12, 13) });
  assert.deepEqual(moments, [{ kind: "streak_up", id: "streak_up:2026-10-17", streak: 13, week: [...WEEK] }]);
});

test("collectMoments(): streak unchanged (already touched today) never fires streak_up", () => {
  const moments = collectMoments({ ...base(), streak: streak(13, 13) });
  assert.equal(moments.length, 0);
});

test("collectMoments(): a freeze save produces freeze_used instead of streak_up", () => {
  const moments = collectMoments({ ...base(), streak: streak(12, 13, { usedFreeze: true }) });
  assert.deepEqual(moments, [{ kind: "freeze_used", id: "freeze_used:2026-10-17", streak: 13, week: [...WEEK] }]);
});

test("collectMoments(): a fresh break with Earn-back offered produces earn_back, not streak_up", () => {
  const moments = collectMoments({ ...base(), streak: streak(12, 1, { repairStarted: true, streakBeforeBreak: 12 }) });
  assert.deepEqual(moments, [{ kind: "earn_back", id: "earn_back:2026-10-17", streakBeforeBreak: 12 }]);
});

test("collectMoments(): a successfully completed repair is a plain streak_up with the restored number", () => {
  // streak-engine.ts never puts milestonesCrossed on a repair completion — collectMoments just
  // reflects whatever it's given, this documents the expected shape when it does its job.
  const moments = collectMoments({ ...base(), streak: streak(2, 12) });
  assert.deepEqual(moments, [{ kind: "streak_up", id: "streak_up:2026-10-17", streak: 12, week: [...WEEK] }]);
});

test("collectMoments(): a repair failing (reset to 1, no offer) produces no streak moment at all", () => {
  const moments = collectMoments({ ...base(), streak: streak(2, 1) });
  assert.equal(moments.length, 0);
});

test("collectMoments(): crossing a streak milestone adds a streak_milestone alongside the streak_up", () => {
  const moments = collectMoments({ ...base(), streak: streak(6, 7, { milestonesCrossed: [7] }) });
  assert.deepEqual(moments, [
    { kind: "streak_up", id: "streak_up:2026-10-17", streak: 7, week: [...WEEK] },
    { kind: "streak_milestone", id: "streak_milestone:7", milestone: 7, nextMilestone: 14 },
  ]);
});

test("collectMoments(): the last milestone (365) reports no next milestone", () => {
  const moments = collectMoments({ ...base(), streak: streak(364, 365, { milestonesCrossed: [365] }) });
  assert.deepEqual(moments[1], { kind: "streak_milestone", id: "streak_milestone:365", milestone: 365, nextMilestone: null });
});

test("collectMoments(): each newly-earned achievement id becomes its own moment, in arrival order", () => {
  const moments = collectMoments({ ...base(), newAchievementIds: ["streak_7", "words_100"] });
  assert.deepEqual(moments, [
    { kind: "achievement", id: "achievement:streak_7", achievementId: "streak_7" },
    { kind: "achievement", id: "achievement:words_100", achievementId: "words_100" },
  ]);
});

test("collectMoments(): learning_state reaching maintenance for the first time produces word_mastered", () => {
  const moments = collectMoments({
    ...base(),
    wordMastered: {
      before: "active",
      after: "maintenance",
      flashcardId: "card-1",
      front: "reluctant",
      back: "неохотный",
      timesSeen: 7,
      timesCorrect: 5,
      totalMastered: 843,
    },
  });
  assert.deepEqual(moments, [
    {
      kind: "word_mastered",
      id: "word_mastered:card-1",
      front: "reluctant",
      back: "неохотный",
      timesSeen: 7,
      timesCorrect: 5,
      totalMastered: 843,
    },
  ]);
});

test("collectMoments(): already-maintenance before this review never re-fires word_mastered", () => {
  const moments = collectMoments({
    ...base(),
    wordMastered: {
      before: "maintenance",
      after: "maintenance",
      flashcardId: "card-1",
      front: "x",
      back: "y",
      timesSeen: 9,
      timesCorrect: 8,
      totalMastered: 843,
    },
  });
  assert.equal(moments.length, 0);
});

test("collectMoments(): a single action can fire several moments at once, in priority order", () => {
  const moments = collectMoments({
    xp: { before: { total: 790, today: 40 }, after: { total: 850, today: 55 }, goal: 50, minutesHint: 10 },
    streak: streak(12, 13),
    goalWeek: [...WEEK],
    streakWeek: [...WEEK],
    newAchievementIds: ["streak_7"],
    wordMastered: null,
    today: "2026-10-17",
  });
  assert.deepEqual(
    moments.map((m) => m.kind),
    ["goal_done", "level_up", "streak_up", "achievement"],
  );
});
