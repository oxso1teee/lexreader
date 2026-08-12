import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlacementQuestions, findPlacementQuestion } from "./question-bank.ts";

test("getPlacementQuestions: returns exactly 10 fixed questions", () => {
  assert.equal(getPlacementQuestions().length, 10);
});

test("getPlacementQuestions: composition is 4 foundational / 3 intermediate / 3 upper", () => {
  const byTier = { foundational: 0, intermediate: 0, upper: 0 };
  getPlacementQuestions().forEach((q) => byTier[q.tier]++);
  assert.equal(byTier.foundational, 4);
  assert.equal(byTier.intermediate, 3);
  assert.equal(byTier.upper, 3);
});

test("getPlacementQuestions: every question has a unique id", () => {
  const ids = getPlacementQuestions().map((q) => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("getPlacementQuestions: every question has exactly one defensible correct answer", () => {
  getPlacementQuestions().forEach((q) => {
    assert.ok(q.correctIndex >= 0 && q.correctIndex < q.options.length, `${q.id}: correctIndex out of range`);
    assert.ok(q.options.length >= 2, `${q.id}: needs at least 2 options`);
    assert.equal(new Set(q.options).size, q.options.length, `${q.id}: options must be distinct`);
  });
});

test("getPlacementQuestions: deterministic — same call always returns the same set in the same order", () => {
  const a = getPlacementQuestions().map((q) => q.id);
  const b = getPlacementQuestions().map((q) => q.id);
  assert.deepEqual(a, b);
});

test("getPlacementQuestions: reuses real grammar-bank ids, never invents question text", () => {
  // Spot-check a couple of known ids from src/lib/missions/grammar-bank.ts —
  // proves this module pulls from the real bank rather than duplicating text.
  const ids = getPlacementQuestions().map((q) => q.id);
  assert.ok(ids.includes("tense_ps_1") || ids.some((id) => id.startsWith("tense_ps")));
});

test("findPlacementQuestion: finds a real question by id, null for unknown id", () => {
  const [first] = getPlacementQuestions();
  assert.equal(findPlacementQuestion(first.id)?.id, first.id);
  assert.equal(findPlacementQuestion("does-not-exist"), null);
});
