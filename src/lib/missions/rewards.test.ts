import test from "node:test";
import assert from "node:assert/strict";
import { missionXpReward } from "./rewards.ts";

test("missionXpReward scales with step_count and adds a real difficulty bonus", () => {
  assert.equal(missionXpReward({ step_count: 5, difficulty: "easy" }), 15);
  assert.equal(missionXpReward({ step_count: 5, difficulty: "medium" }), 20);
  assert.equal(missionXpReward({ step_count: 5, difficulty: "hard" }), 25);
});

test("missionXpReward is 0 for a 0-step easy mission, never negative", () => {
  assert.equal(missionXpReward({ step_count: 0, difficulty: "easy" }), 0);
});
