import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyGoalProgress } from "./goal.ts";
import { greetingSubline, streakExtendedLine, weekNote } from "./copy.ts";

test("greetingSubline(): подпись зависит от режима экрана и остатка до цели", () => {
  assert.equal(greetingSubline("regular", dailyGoalProgress(30, 50)), "Ещё 20 XP до цели дня");
  assert.equal(greetingSubline("goal-done", dailyGoalProgress(50, 50)), "Цель дня выполнена");
  assert.equal(greetingSubline("first-day", dailyGoalProgress(0, 50)), "Первый день — начнём с малого");
});

test("greetingSubline(): обычный режим с уже выполненной целью не пишет «Ещё 0 XP»", () => {
  assert.equal(greetingSubline("regular", dailyGoalProgress(60, 50)), "Цель дня выполнена");
});

test("streakExtendedLine(): только для серии, продлённой сегодня, со склонением", () => {
  assert.equal(streakExtendedLine("extended", 13), "Серия продлена — 13 дней подряд");
  assert.equal(streakExtendedLine("extended", 1), "Серия продлена — 1 день подряд");
  assert.equal(streakExtendedLine("extended", 22), "Серия продлена — 22 дня подряд");
  assert.equal(streakExtendedLine("alive", 13), null);
  assert.equal(streakExtendedLine("broken", 0), null);
  assert.equal(streakExtendedLine("extended", 0), null);
});

test("weekNote(): прерванная серия, пустая история и рекорд — три разных подписи", () => {
  assert.equal(weekNote({ streakState: "broken", streakLongest: 21 }), "Серия прервалась — начни новую");
  assert.equal(weekNote({ streakState: "none", streakLongest: 0 }), "Начни серию сегодня");
  assert.equal(weekNote({ streakState: "extended", streakLongest: 21 }), "Рекорд: 21 день");
  assert.equal(weekNote({ streakState: "alive", streakLongest: 3 }), "Рекорд: 3 дня");
  assert.equal(weekNote({ streakState: "alive", streakLongest: 12 }), "Рекорд: 12 дней");
});

test("weekNote(): серии нет сейчас, но рекорд был — показываем рекорд, а не призыв «начать»", () => {
  assert.equal(weekNote({ streakState: "none", streakLongest: 7 }), "Рекорд: 7 дней");
});

test("weekNote(): живая серия без рекорда (не должно случаться) — подписи нет", () => {
  assert.equal(weekNote({ streakState: "alive", streakLongest: 0 }), null);
});
