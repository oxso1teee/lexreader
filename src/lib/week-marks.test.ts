import { test } from "node:test";
import assert from "node:assert/strict";
import { weekMarks } from "./week-marks.ts";

// 2026-10-15 — четверг.
const thu = new Date("2026-10-15T09:00:00.000Z");

test("weekMarks(): Mon–Wed active, Thursday not yet → done×3, today, future×3", () => {
  assert.deepEqual(weekMarks(["2026-10-12", "2026-10-13", "2026-10-14"], thu), ["done", "done", "done", "today", "future", "future", "future"]);
});

test("weekMarks(): activity today shows as done, a skipped past day as missed", () => {
  assert.deepEqual(weekMarks(["2026-10-12", "2026-10-15"], thu), ["done", "missed", "missed", "done", "future", "future", "future"]);
});

test("weekMarks(): dates outside the current week are ignored", () => {
  assert.deepEqual(weekMarks(["2026-10-11", "2026-10-19"], thu), ["missed", "missed", "missed", "today", "future", "future", "future"]);
});
