import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSentence } from "./correction-rules.ts";

test("checkSentence: catches a known preposition error", () => {
  const result = checkSentence("It depends of the weather.");
  assert.equal(result.supported, true);
  assert.ok(result.matches.some((m) => m.patternKey === "prep_depend_of"));
});

test("checkSentence: catches multiple independent errors in one sentence", () => {
  const result = checkSentence("It depends of the weather and he is married with a doctor.");
  const keys = result.matches.map((m) => m.patternKey);
  assert.ok(keys.includes("prep_depend_of"));
  assert.ok(keys.includes("prep_married_with"));
});

test("checkSentence: a clean sentence is supported with zero matches", () => {
  const result = checkSentence("I read a book yesterday and enjoyed it.");
  assert.equal(result.supported, true);
  assert.equal(result.matches.length, 0);
});

test("checkSentence: empty input is unsupported, not a clean result", () => {
  const result = checkSentence("   ");
  assert.equal(result.supported, false);
  assert.equal(result.matches.length, 0);
});

test("checkSentence: overly long input is unsupported", () => {
  const result = checkSentence("word ".repeat(200));
  assert.equal(result.supported, false);
});

test("checkSentence: non-Latin input is unsupported", () => {
  const result = checkSentence("привет как дела");
  assert.equal(result.supported, false);
});

test("checkSentence: article heuristic is always low confidence", () => {
  const result = checkSentence("I read book yesterday.");
  const articleMatch = result.matches.find((m) => m.category === "article");
  assert.ok(articleMatch);
  assert.equal(articleMatch?.confidence, "low");
});

test("checkSentence: possession heuristic fires on literal-translation pattern", () => {
  const result = checkSentence("This is the car of my friend.");
  assert.ok(result.matches.some((m) => m.category === "possession"));
});
