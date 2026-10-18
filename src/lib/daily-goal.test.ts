import { test } from "node:test";
import assert from "node:assert/strict";
import { minutesHintForGoal } from "./daily-goal.ts";

test("minutesHintForGoal(): each real preset maps to its documented minutes", () => {
  assert.equal(minutesHintForGoal(20), 5);
  assert.equal(minutesHintForGoal(50), 10);
  assert.equal(minutesHintForGoal(80), 15);
  assert.equal(minutesHintForGoal(120), 20);
});

test("minutesHintForGoal(): an off-preset goal scales from the nearest preset instead of guessing blindly", () => {
  assert.equal(minutesHintForGoal(100), 19);
});
