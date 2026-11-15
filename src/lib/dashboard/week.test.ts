import { test } from "node:test";
import assert from "node:assert/strict";
import { WEEKDAY_LONG, WEEKDAY_SHORT, todayColumn, weekDoneCount } from "./week.ts";

test("todayColumn(): понедельник — 0, воскресенье — 6 (UTC)", () => {
  assert.equal(todayColumn(new Date("2026-11-09T12:00:00Z")), 0); // понедельник
  assert.equal(todayColumn(new Date("2026-11-13T12:00:00Z")), 4); // пятница
  assert.equal(todayColumn(new Date("2026-11-15T23:59:00Z")), 6); // воскресенье
});

test("WEEKDAY_*: по семь подписей, порядок совпадает с колонками", () => {
  assert.equal(WEEKDAY_SHORT.length, 7);
  assert.equal(WEEKDAY_LONG.length, 7);
  assert.equal(WEEKDAY_SHORT[todayColumn(new Date("2026-11-12T10:00:00Z"))], "Чт");
  assert.equal(WEEKDAY_LONG[todayColumn(new Date("2026-11-12T10:00:00Z"))], "четверг");
});

test("weekDoneCount(): считает дни с занятиями, заморозку и пустые дни — нет", () => {
  assert.equal(weekDoneCount(["done", "done", "freeze", "today", "empty", "empty", "empty"]), 2);
  assert.equal(weekDoneCount(["empty", "empty", "empty", "today", "empty", "empty", "empty"]), 0);
  assert.equal(weekDoneCount([]), 0);
});
