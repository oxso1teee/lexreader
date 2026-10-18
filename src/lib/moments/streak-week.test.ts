import { test } from "node:test";
import assert from "node:assert/strict";
import { streakWeekMarks } from "./streak-week.ts";

// 2026-10-15 — четверг.
const thu = new Date("2026-10-15T09:00:00.000Z");

test("streakWeekMarks(): active days are done, today without activity is today, rest empty", () => {
  assert.deepEqual(streakWeekMarks(["2026-10-12", "2026-10-13"], [], thu), [
    "done",
    "done",
    "empty",
    "today",
    "empty",
    "empty",
    "empty",
  ]);
});

test("streakWeekMarks(): a frozen day takes priority over being merely active", () => {
  assert.deepEqual(streakWeekMarks(["2026-10-14"], ["2026-10-14"], thu), [
    "empty",
    "empty",
    "freeze",
    "today",
    "empty",
    "empty",
    "empty",
  ]);
});

test("streakWeekMarks(): today itself can be frozen (e.g. a late-night freeze save)", () => {
  assert.deepEqual(streakWeekMarks([], ["2026-10-15"], thu), [
    "empty",
    "empty",
    "empty",
    "freeze",
    "empty",
    "empty",
    "empty",
  ]);
});
