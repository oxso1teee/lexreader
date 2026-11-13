import { test } from "node:test";
import assert from "node:assert/strict";
import { generateQuestTargets, longestCorrectStreak, allQuestsComplete, type DailyQuestDef } from "./daily-quests.ts";

test("longestCorrectStreak: all correct", () => {
  assert.equal(longestCorrectStreak([2, 3, 2, 3]), 4);
});

test("longestCorrectStreak: resets on a wrong grade (0 or 1)", () => {
  assert.equal(longestCorrectStreak([2, 2, 0, 2, 2, 2, 1, 2]), 3);
});

test("longestCorrectStreak: empty history", () => {
  assert.equal(longestCorrectStreak([]), 0);
});

test("longestCorrectStreak: never a single correct grade", () => {
  assert.equal(longestCorrectStreak([0, 1, 0]), 0);
});

test("longestCorrectStreak: best run can be at the end", () => {
  assert.equal(longestCorrectStreak([2, 0, 2, 2, 2, 2]), 4);
});

test("generateQuestTargets: deterministic with injected rand, within documented ranges", () => {
  const defs = generateQuestTargets(() => 0);
  const byType = new Map(defs.map((d) => [d.questType, d.target]));
  assert.equal(byType.get("read_minutes"), 5);
  assert.equal(byType.get("review_words"), 10);
  assert.equal(byType.get("combo_streak"), 3);

  const defsMax = generateQuestTargets(() => 0.999);
  const byTypeMax = new Map(defsMax.map((d) => [d.questType, d.target]));
  assert.equal(byTypeMax.get("read_minutes"), 15);
  assert.equal(byTypeMax.get("review_words"), 20);
  assert.equal(byTypeMax.get("combo_streak"), 7);
});

test("generateQuestTargets: always exactly the 3 distinct quest types", () => {
  const defs = generateQuestTargets(() => 0.5);
  assert.equal(defs.length, 3);
  assert.deepEqual(
    new Set(defs.map((d) => d.questType)),
    new Set(["read_minutes", "review_words", "combo_streak"]),
  );
});

test("allQuestsComplete: true only when every quest's progress meets its target", () => {
  const defs: DailyQuestDef[] = [
    { questType: "read_minutes", target: 10 },
    { questType: "review_words", target: 15 },
    { questType: "combo_streak", target: 5 },
  ];
  assert.equal(allQuestsComplete(defs, { read_minutes: 10, review_words: 15, combo_streak: 5 }), true);
  assert.equal(allQuestsComplete(defs, { read_minutes: 20, review_words: 20, combo_streak: 10 }), true);
  assert.equal(allQuestsComplete(defs, { read_minutes: 9, review_words: 15, combo_streak: 5 }), false);
});

test("allQuestsComplete: false when nothing started", () => {
  const defs: DailyQuestDef[] = [
    { questType: "read_minutes", target: 10 },
    { questType: "review_words", target: 15 },
    { questType: "combo_streak", target: 5 },
  ];
  assert.equal(allQuestsComplete(defs, { read_minutes: 0, review_words: 0, combo_streak: 0 }), false);
});
