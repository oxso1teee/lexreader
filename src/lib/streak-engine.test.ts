import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStreakUpdate, crossedMilestones, type StreakProfileSnapshot } from "./streak-engine.ts";

const TODAY = "2026-10-17";
const YESTERDAY = "2026-10-16";
const TWO_DAYS_AGO = "2026-10-15";
const WEEK_START = "2026-10-12";

function profile(overrides: Partial<StreakProfileSnapshot> = {}): StreakProfileSnapshot {
  return {
    streakCurrent: 5,
    streakLongest: 20,
    lastActiveDate: YESTERDAY,
    freezeAvailable: true,
    freezeWeek: WEEK_START,
    streakBeforeBreak: null,
    repairUntil: null,
    ...overrides,
  };
}

test("computeStreakUpdate(): already touched today is a no-op", () => {
  assert.equal(computeStreakUpdate(profile({ lastActiveDate: TODAY }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START), null);
});

test("computeStreakUpdate(): active yesterday increments by one", () => {
  const u = computeStreakUpdate(profile(), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.equal(u.streakCurrent, 6);
  assert.equal(u.before, 5);
  assert.equal(u.after, 6);
  assert.equal(u.usedFreeze, false);
  assert.equal(u.repairStarted, false);
});

test("computeStreakUpdate(): a one-day gap with an available freeze is saved, not broken", () => {
  const u = computeStreakUpdate(profile({ lastActiveDate: TWO_DAYS_AGO }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.equal(u.streakCurrent, 6);
  assert.equal(u.usedFreeze, true);
  assert.equal(u.frozenDay, YESTERDAY);
  assert.equal(u.freezeAvailable, false);
});

test("computeStreakUpdate(): freeze recharges on a new ISO week even if marked spent", () => {
  const u = computeStreakUpdate(
    profile({ lastActiveDate: TWO_DAYS_AGO, freezeAvailable: false, freezeWeek: "2026-10-05" }),
    TODAY,
    YESTERDAY,
    TWO_DAYS_AGO,
    WEEK_START,
  )!;
  assert.equal(u.usedFreeze, true);
  assert.equal(u.freezeWeek, WEEK_START);
});

test("computeStreakUpdate(): a one-day gap with no freeze available breaks the streak", () => {
  const u = computeStreakUpdate(profile({ lastActiveDate: TWO_DAYS_AGO, freezeAvailable: false }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.equal(u.usedFreeze, false);
  assert.equal(u.streakCurrent, 1);
  assert.equal(u.repairStarted, true);
});

test("computeStreakUpdate(): a genuine multi-day-old break offers Earn-back when the dead streak was real (>1)", () => {
  const u = computeStreakUpdate(profile({ streakCurrent: 12, lastActiveDate: "2026-10-10" }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.equal(u.streakCurrent, 1);
  assert.equal(u.after, 1);
  assert.equal(u.repairStarted, true);
  assert.equal(u.streakBeforeBreak, 12);
  assert.equal(u.repairUntil, "2026-10-19");
});

test("computeStreakUpdate(): breaking from a streak of exactly 1 never offers Earn-back", () => {
  const u = computeStreakUpdate(profile({ streakCurrent: 1, lastActiveDate: "2026-10-10" }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.equal(u.repairStarted, false);
  assert.equal(u.streakBeforeBreak, null);
  assert.equal(u.repairUntil, null);
});

test("computeStreakUpdate(): a second break while a repair is already pending never stacks a new repair", () => {
  const u = computeStreakUpdate(
    profile({ streakCurrent: 1, lastActiveDate: "2026-10-10", streakBeforeBreak: 20, repairUntil: "2026-10-11" }),
    TODAY,
    YESTERDAY,
    TWO_DAYS_AGO,
    WEEK_START,
  )!;
  // repair already expired (today > repairUntil) and streakCurrent is only 1 -> no new repair.
  assert.equal(u.repairStarted, false);
});

test("computeStreakUpdate(): day 1 of a repair window continues it to day 2 without restoring yet", () => {
  const u = computeStreakUpdate(
    profile({ streakCurrent: 1, streakBeforeBreak: 12, repairUntil: "2026-10-19" }),
    TODAY,
    YESTERDAY,
    TWO_DAYS_AGO,
    WEEK_START,
  )!;
  assert.equal(u.streakCurrent, 2);
  assert.equal(u.repairCompleted, false);
  assert.equal(u.streakBeforeBreak, 12);
  assert.equal(u.repairUntil, "2026-10-19");
});

test("computeStreakUpdate(): day 3 of a repair window restores the old count exactly, not the accumulated repair count", () => {
  const u = computeStreakUpdate(
    profile({ streakCurrent: 2, streakBeforeBreak: 12, repairUntil: "2026-10-19" }),
    TODAY,
    YESTERDAY,
    TWO_DAYS_AGO,
    WEEK_START,
  )!;
  assert.equal(u.streakCurrent, 12);
  assert.equal(u.repairCompleted, true);
  assert.equal(u.streakBeforeBreak, null);
  assert.equal(u.repairUntil, null);
  // Restoring a number already reached before the break must never re-fire its milestone.
  assert.deepEqual(u.milestonesCrossed, []);
});

test("computeStreakUpdate(): missing a day mid-repair fails it and resets to 1, no new repair offered", () => {
  const u = computeStreakUpdate(
    profile({ streakCurrent: 1, lastActiveDate: TWO_DAYS_AGO, streakBeforeBreak: 12, repairUntil: "2026-10-19" }),
    TODAY,
    YESTERDAY,
    TWO_DAYS_AGO,
    WEEK_START,
  )!;
  assert.equal(u.streakCurrent, 1);
  assert.equal(u.repairFailed, true);
  assert.equal(u.repairStarted, false);
  assert.equal(u.streakBeforeBreak, null);
  assert.equal(u.repairUntil, null);
});

test("computeStreakUpdate(): a repair window that already expired is treated as a fresh break, not a continuation", () => {
  const u = computeStreakUpdate(
    profile({ streakCurrent: 2, streakBeforeBreak: 12, repairUntil: "2026-10-16" }),
    TODAY,
    YESTERDAY,
    TWO_DAYS_AGO,
    WEEK_START,
  )!;
  // repairUntil (10-16) < today (10-17) -> not repairActive; lastActiveDate===yesterday -> normal increment path.
  assert.equal(u.streakCurrent, 3);
  assert.equal(u.repairCompleted, false);
});

test("computeStreakUpdate(): crossing a milestone on a normal increment reports it", () => {
  const u = computeStreakUpdate(profile({ streakCurrent: 6 }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.deepEqual(u.milestonesCrossed, [7]);
});

test("computeStreakUpdate(): reaching a milestone actually grants a freeze, even if already spent this week", () => {
  const u = computeStreakUpdate(profile({ streakCurrent: 6, freezeAvailable: false }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.deepEqual(u.milestonesCrossed, [7]);
  assert.equal(u.freezeAvailable, true);
});

test("computeStreakUpdate(): not reaching a milestone never grants a free freeze back", () => {
  const u = computeStreakUpdate(profile({ streakCurrent: 8, freezeAvailable: false }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.deepEqual(u.milestonesCrossed, []);
  assert.equal(u.freezeAvailable, false);
});

test("computeStreakUpdate(): crossing a milestone via a freeze save reports it too", () => {
  const u = computeStreakUpdate(profile({ streakCurrent: 6, lastActiveDate: TWO_DAYS_AGO }), TODAY, YESTERDAY, TWO_DAYS_AGO, WEEK_START)!;
  assert.deepEqual(u.milestonesCrossed, [7]);
});

test("crossedMilestones(): only milestones strictly after `before` and at-or-before `after`", () => {
  assert.deepEqual(crossedMilestones(5, 8), [7]);
  assert.deepEqual(crossedMilestones(7, 7), []);
  assert.deepEqual(crossedMilestones(0, 400), [7, 14, 30, 50, 100, 365]);
  assert.deepEqual(crossedMilestones(10, 10), []);
});
