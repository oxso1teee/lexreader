import { test } from "node:test";
import assert from "node:assert/strict";
import { isPerfectWeek, type PerfectWeekDay } from "./perfect-week.ts";

const day = (goalMet: boolean, freezeUsed = false): PerfectWeekDay => ({ goalMet, freezeUsed });

test("isPerfectWeek(): all 7 days goal-met and no freeze is perfect", () => {
  assert.equal(isPerfectWeek(Array.from({ length: 7 }, () => day(true))), true);
});

test("isPerfectWeek(): fewer than 7 days (week not over yet, or a missing row) is never perfect", () => {
  assert.equal(isPerfectWeek(Array.from({ length: 6 }, () => day(true))), false);
});

test("isPerfectWeek(): any single day missing the goal breaks it", () => {
  const days = Array.from({ length: 7 }, () => day(true));
  days[3] = day(false);
  assert.equal(isPerfectWeek(days), false);
});

test("isPerfectWeek(): a freeze anywhere in the week disqualifies it even if the goal was still met that day", () => {
  const days = Array.from({ length: 7 }, () => day(true));
  days[2] = day(true, true);
  assert.equal(isPerfectWeek(days), false);
});
