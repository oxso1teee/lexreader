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

// M3 Slice 8 (Learning Paths v1) additions below.

test("GRAMMAR_RUNNER_CATEGORIES: includes exactly the 5 new Learning Paths categories", () => {
  for (const c of ["comparative", "modal", "relative_clause", "conditional", "question_formation"] as const) {
    assert.ok(GRAMMAR_RUNNER_CATEGORIES.includes(c), c);
  }
});

test("buildGrammarQuestionSet: subTopic narrows tense to exactly one sub-topic, without a subTopic draws from all", () => {
  const presentSimpleOnly = buildGrammarQuestionSet("tense", 20, "seed", "present_simple");
  assert.ok(presentSimpleOnly.length > 0);
  assert.ok(presentSimpleOnly.every((q) => q.subTopic === "present_simple"));

  const wholeCategory = buildGrammarQuestionSet("tense", 20, "seed");
  const subTopicsSeen = new Set(wholeCategory.map((q) => q.subTopic));
  assert.ok(subTopicsSeen.size > 1, "no subTopic filter should mix present_simple/present_continuous/past_simple");
});

test("buildGrammarQuestionSet: subTopic with no matching questions returns an empty set", () => {
  assert.deepEqual(buildGrammarQuestionSet("tense", 5, "seed", "future_perfect"), []);
});

test("GRAMMAR_QUESTION_BANK: tense is no longer only Present Continuous", () => {
  const subTopics = new Set(GRAMMAR_QUESTION_BANK.filter((q) => q.category === "tense").map((q) => q.subTopic));
  assert.ok(subTopics.has("present_simple"));
  assert.ok(subTopics.has("present_continuous"));
  assert.ok(subTopics.has("past_simple"));
});
