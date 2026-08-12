import { test } from "node:test";
import assert from "node:assert/strict";
import { scorePlacement, hasSelfReportConflict, rangeFromSelfReport } from "./scoring.ts";
import type { PlacementAnswerRecord } from "./types.ts";

function answer(tier: PlacementAnswerRecord["tier"], category: string, correct: boolean): PlacementAnswerRecord {
  return { questionId: `${category}-${Math.random()}`, category: category as PlacementAnswerRecord["category"], tier, correct };
}

function allCorrect(): PlacementAnswerRecord[] {
  return [
    answer("foundational", "tense", true),
    answer("foundational", "tense", true),
    answer("foundational", "word_order", true),
    answer("foundational", "question_formation", true),
    answer("intermediate", "article", true),
    answer("intermediate", "preposition", true),
    answer("intermediate", "modal", true),
    answer("upper", "passive", true),
    answer("upper", "relative_clause", true),
    answer("upper", "conditional", true),
  ];
}

test("scorePlacement: all 10 correct -> B2+, high confidence", () => {
  const result = scorePlacement(allCorrect(), "B2");
  assert.equal(result.range, "B2+");
  assert.equal(result.confidence, "high");
  assert.equal(result.correctCount, 10);
});

test("scorePlacement: foundation floor caps range at A1–A2 when 2+ foundational answers are wrong, even with correct upper answers", () => {
  const answers = allCorrect();
  answers[0].correct = false; // foundational
  answers[1].correct = false; // foundational
  const result = scorePlacement(answers, null);
  assert.equal(result.range, "A1–A2");
});

test("scorePlacement: incomplete attempt (< 10 answers) is always low confidence", () => {
  const result = scorePlacement(allCorrect().slice(0, 6), "B1");
  assert.equal(result.confidence, "low");
});

test("scorePlacement: tier inversion (missed foundational, aced upper) yields medium confidence, not high", () => {
  const answers = allCorrect();
  answers[0].correct = false; // exactly 1 foundational miss — below the floor's 2-miss threshold
  const result = scorePlacement(answers, null);
  assert.notEqual(result.range, "A1–A2"); // floor not triggered (only 1 miss)
  assert.equal(result.confidence, "medium"); // but inversion still flags medium
});

test("scorePlacement: self-report vs placement conflict (B2 self-report, A1–A2 placement) yields medium confidence", () => {
  const answers = allCorrect().map((a) => ({ ...a, correct: false }));
  const result = scorePlacement(answers, "B2");
  assert.equal(result.range, "A1–A2");
  assert.equal(result.confidence, "medium");
});

test("scorePlacement: never returns a fake decimal or 'Official' range — output is one of the 4 fixed buckets", () => {
  const allowed = ["A1–A2", "A2–B1", "B1–B2", "B2+"];
  [allCorrect(), allCorrect().slice(0, 3), []].forEach((answers) => {
    assert.ok(allowed.includes(scorePlacement(answers, null).range));
  });
});

test("scorePlacement: strong/weak categories reflect all-correct / all-wrong categories only", () => {
  const answers = allCorrect();
  answers[4].correct = false; // article — its only question, now wrong
  const result = scorePlacement(answers, null);
  assert.ok(result.weakCategories.includes("article" as never));
  assert.ok(result.strongCategories.includes("passive" as never));
});

test("hasSelfReportConflict: true when self-report is 2+ buckets above placement", () => {
  assert.equal(hasSelfReportConflict("A1–A2", "B2"), true);
  assert.equal(hasSelfReportConflict("B1–B2", "B2"), false);
  assert.equal(hasSelfReportConflict("A1–A2", "unsure"), false);
  assert.equal(hasSelfReportConflict("A1–A2", null), false);
});

test("rangeFromSelfReport: maps self-report buckets to the same 4-value range vocabulary", () => {
  assert.equal(rangeFromSelfReport("A1"), "A1–A2");
  assert.equal(rangeFromSelfReport("A2"), "A2–B1");
  assert.equal(rangeFromSelfReport("B1"), "B1–B2");
  assert.equal(rangeFromSelfReport("B2"), "B1–B2");
  assert.equal(rangeFromSelfReport("unsure"), "A2–B1");
  assert.equal(rangeFromSelfReport(null), "A2–B1");
});
