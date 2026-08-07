import { test } from "node:test";
import assert from "node:assert/strict";
import { GRAMMAR_QUESTION_BANK, GRAMMAR_RUNNER_CATEGORIES, buildGrammarQuestionSet } from "./grammar-bank.ts";

test("GRAMMAR_QUESTION_BANK: every supported category has at least 5 questions", () => {
  for (const category of GRAMMAR_RUNNER_CATEGORIES) {
    const count = GRAMMAR_QUESTION_BANK.filter((q) => q.category === category).length;
    assert.ok(count >= 5, `${category} only has ${count} questions`);
  }
});

test("GRAMMAR_QUESTION_BANK: every question's correctIndex points at a real option", () => {
  for (const q of GRAMMAR_QUESTION_BANK) {
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, q.id);
  }
});

test("GRAMMAR_QUESTION_BANK: question ids are unique", () => {
  const ids = GRAMMAR_QUESTION_BANK.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("buildGrammarQuestionSet: deterministic — same category+seed always returns the same questions in the same order", () => {
  const a = buildGrammarQuestionSet("tense", 5, "mission-seed-1");
  const b = buildGrammarQuestionSet("tense", 5, "mission-seed-1");
  assert.deepEqual(a, b);
});

test("buildGrammarQuestionSet: different seeds can return a different rotation", () => {
  const a = buildGrammarQuestionSet("tense", 5, "seed-a");
  const b = buildGrammarQuestionSet("tense", 5, "seed-b-longer-different");
  // Not guaranteed to differ for every possible pair, but with 8 tense
  // questions and these two seeds it should — if this ever flakes because
  // of a hash collision, swap in different seed strings rather than
  // deleting the intent of the test.
  assert.notDeepEqual(a.map((q) => q.id), b.map((q) => q.id));
});

test("buildGrammarQuestionSet: returns exactly `count` questions when the bank has enough", () => {
  const set = buildGrammarQuestionSet("tense", 5, "seed");
  assert.equal(set.length, 5);
});

test("buildGrammarQuestionSet: never returns duplicate questions within one set", () => {
  const set = buildGrammarQuestionSet("preposition", 5, "seed-x");
  const ids = set.map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("buildGrammarQuestionSet: unknown/unsupported category returns an empty set, not a crash", () => {
  assert.deepEqual(buildGrammarQuestionSet("spelling", 5, "seed"), []);
  assert.deepEqual(buildGrammarQuestionSet("collocation", 5, "seed"), []);
  assert.deepEqual(buildGrammarQuestionSet("activation", 5, "seed"), []);
});
