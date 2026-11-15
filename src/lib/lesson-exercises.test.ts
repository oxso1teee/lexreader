import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize,
  normalizeForComparison,
  buildPhraseExercise,
  checkPhraseAnswer,
  checkListenAnswer,
} from "./lesson-exercises.ts";

function identityShuffle<T>(arr: T[]): T[] {
  return [...arr];
}

test("tokenize splits on whitespace and keeps punctuation attached", () => {
  assert.deepEqual(tokenize("Ей не хотелось уходить с вечеринки."), [
    "Ей",
    "не",
    "хотелось",
    "уходить",
    "с",
    "вечеринки.",
  ]);
});

test("tokenize collapses multiple spaces and trims", () => {
  assert.deepEqual(tokenize("  She   was  reluctant  "), ["She", "was", "reluctant"]);
});

test("normalizeForComparison ignores case and trailing/leading punctuation", () => {
  assert.equal(normalizeForComparison("She was reluctant."), "she was reluctant");
  assert.equal(normalizeForComparison("  SHE WAS reluctant  "), "she was reluctant");
  assert.equal(normalizeForComparison("«Hello»"), "hello");
});

test("normalizeForComparison keeps internal apostrophes/hyphens", () => {
  assert.equal(normalizeForComparison("Don't well-known"), "don't well-known");
});

test("buildPhraseExercise returns the solution in correct order", () => {
  const ex = buildPhraseExercise("She was reluctant to leave.", "Ей не хотелось уходить.", [], identityShuffle);
  assert.deepEqual(ex.solution, ["Ей", "не", "хотелось", "уходить."]);
});

test("buildPhraseExercise includes solution tiles plus distractors from other cards", () => {
  const ex = buildPhraseExercise(
    "She was reluctant to leave.",
    "Ей не хотелось уходить.",
    ["Он был рад прийти.", "Она хотела остаться."],
    identityShuffle,
  );
  for (const word of ex.solution) {
    assert.ok(ex.tiles.includes(word), `missing solution tile ${word}`);
  }
  assert.ok(ex.tiles.length > ex.solution.length);
  assert.ok(ex.tiles.length <= ex.solution.length + 4);
});

test("buildPhraseExercise never duplicates a solution word as a distractor tile", () => {
  const ex = buildPhraseExercise("word", "Ей не хотелось", ["не хотелось идти"], identityShuffle);
  const solutionCount = (word: string) =>
    ex.solution.filter((w) => normalizeForComparison(w) === normalizeForComparison(word)).length;
  const tileCount = (word: string) =>
    ex.tiles.filter((w) => normalizeForComparison(w) === normalizeForComparison(word)).length;
  for (const word of ex.solution) {
    assert.equal(tileCount(word), solutionCount(word), `tile count for "${word}" should match solution count`);
  }
});

test("buildPhraseExercise with no distractors still works (single-word answer)", () => {
  const ex = buildPhraseExercise("cat", "кот", [], identityShuffle);
  assert.deepEqual(ex.tiles, ["кот"]);
  assert.deepEqual(ex.solution, ["кот"]);
});

test("checkPhraseAnswer requires correct order", () => {
  const solution = ["Ей", "не", "хотелось", "уходить."];
  assert.equal(checkPhraseAnswer(["Ей", "не", "хотелось", "уходить."], solution), true);
  assert.equal(checkPhraseAnswer(["не", "Ей", "хотелось", "уходить."], solution), false);
});

test("checkPhraseAnswer ignores case and trailing punctuation per tile", () => {
  const solution = ["Ей", "не", "хотелось", "уходить."];
  assert.equal(checkPhraseAnswer(["ей", "НЕ", "хотелось", "уходить"], solution), true);
});

test("checkPhraseAnswer rejects wrong length", () => {
  const solution = ["Ей", "не", "хотелось"];
  assert.equal(checkPhraseAnswer(["Ей", "не"], solution), false);
  assert.equal(checkPhraseAnswer(["Ей", "не", "хотелось", "уходить"], solution), false);
});

test("checkListenAnswer ignores case and punctuation", () => {
  assert.equal(checkListenAnswer("she was reluctant to leave", "She was reluctant to leave."), true);
  assert.equal(checkListenAnswer("SHE WAS RELUCTANT TO LEAVE", "She was reluctant to leave."), true);
});

test("checkListenAnswer rejects a different phrase", () => {
  assert.equal(checkListenAnswer("she was happy to leave", "She was reluctant to leave."), false);
});
