import { test } from "node:test";
import assert from "node:assert/strict";
import { goalWeekMarks } from "./week.ts";

// 2026-10-15 — четверг.
const thu = new Date("2026-10-15T09:00:00.000Z");

test("goalWeekMarks(): past/future days without goal_met collapse to empty", () => {
  assert.deepEqual(goalWeekMarks(["2026-10-12", "2026-10-13"], thu), [
    "done",
    "done",
    "empty",
    "today",
    "empty",
    "empty",
    "empty",
  ]);
});

test("goalWeekMarks(): goal met today shows as done, not today", () => {
  assert.deepEqual(goalWeekMarks(["2026-10-15"], thu), [
    "empty",
    "empty",
    "empty",
    "done",
    "empty",
    "empty",
    "empty",
  ]);
});
