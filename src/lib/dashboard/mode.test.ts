import { test } from "node:test";
import assert from "node:assert/strict";
import { accountAgeDays, dashboardMode } from "./mode.ts";

const fresh = { goalDone: false, xp: 0, firstStepsVisible: true, firstStepsDone: 0 };

test("dashboardMode(): новый аккаунт без единого действия — first-day", () => {
  assert.equal(dashboardMode(fresh), "first-day");
});

test("dashboardMode(): цель выполнена важнее любого другого состояния", () => {
  assert.equal(dashboardMode({ ...fresh, goalDone: true }), "goal-done");
  assert.equal(dashboardMode({ ...fresh, goalDone: true, xp: 900, firstStepsVisible: false }), "goal-done");
});

test("dashboardMode(): после первого шага или первого XP экран обычный, чек-лист остаётся внутри него", () => {
  assert.equal(dashboardMode({ ...fresh, firstStepsDone: 1 }), "regular");
  assert.equal(dashboardMode({ ...fresh, xp: 2 }), "regular");
});

test("dashboardMode(): чек-лист скрыт (старый аккаунт или всё выполнено) — обычный экран, не first-day", () => {
  assert.equal(dashboardMode({ ...fresh, firstStepsVisible: false }), "regular");
  assert.equal(dashboardMode({ goalDone: false, xp: 1500, firstStepsVisible: false, firstStepsDone: 3 }), "regular");
});

test("accountAgeDays(): считает полные сутки", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  assert.equal(accountAgeDays("2026-11-13T11:00:00Z", now), 0);
  assert.equal(accountAgeDays("2026-11-12T13:00:00Z", now), 0);
  assert.equal(accountAgeDays("2026-11-12T12:00:00Z", now), 1);
  assert.equal(accountAgeDays("2026-11-06T12:00:00Z", now), 7);
});

test("accountAgeDays(): нет даты или она битая — аккаунт считается старым", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  assert.equal(accountAgeDays(null, now), Number.MAX_SAFE_INTEGER);
  assert.equal(accountAgeDays(undefined, now), Number.MAX_SAFE_INTEGER);
  assert.equal(accountAgeDays("не дата", now), Number.MAX_SAFE_INTEGER);
});

test("accountAgeDays(): дата создания в будущем даёт отрицательное число — вызывающий код её отбрасывает", () => {
  const now = new Date("2026-11-13T12:00:00Z");
  assert.ok(accountAgeDays("2026-11-20T12:00:00Z", now) < 0);
});
