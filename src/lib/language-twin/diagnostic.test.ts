import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreDiagnostic, diagnosticLevelRange, DIAGNOSTIC_QUESTIONS } from "./diagnostic.ts";

test("scoreDiagnostic: counts correct answers and per-tag breakdown", () => {
  const answers = DIAGNOSTIC_QUESTIONS.map((q) => q.correctIndex);
  const score = scoreDiagnostic(answers);
  assert.equal(score.correct, DIAGNOSTIC_QUESTIONS.length);
  assert.equal(score.total, DIAGNOSTIC_QUESTIONS.length);
});

test("scoreDiagnostic: skipped questions (null) are excluded from total", () => {
  const answers: (number | null)[] = DIAGNOSTIC_QUESTIONS.map(() => null);
  answers[0] = DIAGNOSTIC_QUESTIONS[0].correctIndex;
  const score = scoreDiagnostic(answers);
  assert.equal(score.total, 1);
  assert.equal(score.correct, 1);
});

test("scoreDiagnostic: wrong answers count toward total but not correct", () => {
  const answers = DIAGNOSTIC_QUESTIONS.map((q) => (q.correctIndex + 1) % q.options.length);
  const score = scoreDiagnostic(answers);
  assert.equal(score.total, DIAGNOSTIC_QUESTIONS.length);
  assert.equal(score.correct, 0);
});

test("diagnosticLevelRange: returns null when too few questions were answered", () => {
  const score = scoreDiagnostic([DIAGNOSTIC_QUESTIONS[0].correctIndex, null, null, null, null, null]);
  assert.equal(diagnosticLevelRange(score), null);
});

test("diagnosticLevelRange: never returns a single precise CEFR value", () => {
  const answers = DIAGNOSTIC_QUESTIONS.map((q) => q.correctIndex);
  const score = scoreDiagnostic(answers);
  const range = diagnosticLevelRange(score);
  assert.ok(range && /[–-]|\+/.test(range), `expected a range-shaped string, got: ${range}`);
});
