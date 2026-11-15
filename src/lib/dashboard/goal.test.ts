import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyGoalProgress } from "./goal.ts";

test("dailyGoalProgress(): частичный прогресс — доля, процент, остаток, ориентир в минутах", () => {
  const p = dailyGoalProgress(30, 50);
  assert.equal(p.xpToday, 30);
  assert.equal(p.xpGoal, 50);
  assert.equal(p.value, 0.6);
  assert.equal(p.percent, 60);
  assert.equal(p.remaining, 20);
  assert.equal(p.done, false);
  assert.equal(p.goalMinutes, 10);
});

test("dailyGoalProgress(): ровно цель — выполнено, остатка нет", () => {
  const p = dailyGoalProgress(50, 50);
  assert.equal(p.done, true);
  assert.equal(p.value, 1);
  assert.equal(p.percent, 100);
  assert.equal(p.remaining, 0);
});

test("dailyGoalProgress(): перевыполнение не уводит долю выше 1, а остаток ниже 0", () => {
  const p = dailyGoalProgress(80, 50);
  assert.equal(p.value, 1);
  assert.equal(p.percent, 100);
  assert.equal(p.remaining, 0);
  assert.equal(p.done, true);
  assert.equal(p.xpToday, 80, "сколько реально набрано — показываем как есть");
});

test("dailyGoalProgress(): ноль XP — цель не выполнена, остаток равен цели", () => {
  const p = dailyGoalProgress(0, 120);
  assert.equal(p.value, 0);
  assert.equal(p.remaining, 120);
  assert.equal(p.done, false);
  assert.equal(p.goalMinutes, 20);
});

test("dailyGoalProgress(): битые значения (NaN, минус, ноль-цель) не дают NaN и деления на ноль", () => {
  const broken = dailyGoalProgress(Number.NaN, 0);
  assert.equal(broken.xpToday, 0);
  assert.equal(broken.xpGoal, 50, "цель по умолчанию");
  assert.equal(broken.value, 0);
  assert.equal(broken.done, false);

  const negative = dailyGoalProgress(-5, -10);
  assert.equal(negative.xpToday, 0);
  assert.equal(negative.xpGoal, 50);
});

test("dailyGoalProgress(): дробные значения усекаются до целых XP", () => {
  const p = dailyGoalProgress(24.9, 50.7);
  assert.equal(p.xpToday, 24);
  assert.equal(p.xpGoal, 50);
});
