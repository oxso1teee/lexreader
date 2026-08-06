import { test } from "node:test";
import assert from "node:assert/strict";
import { detectActivationGaps, type ActivationCandidate } from "./activation-gap.ts";

function candidate(overrides: Partial<ActivationCandidate>): ActivationCandidate {
  return {
    vocabularyItemId: "v1",
    flashcardId: "f1",
    headword: "perceive",
    translation: "воспринимать",
    readingLevel: 4,
    reviewGrades: [],
    ...overrides,
  };
}

test("detectActivationGaps: flags a word known in Reading but failing review", () => {
  const result = detectActivationGaps([
    candidate({
      reviewGrades: [
        { grade: 0, reviewedAt: "2026-07-01" },
        { grade: 1, reviewedAt: "2026-07-15" },
        { grade: 0, reviewedAt: "2026-08-01" },
      ],
    }),
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].headword, "perceive");
  assert.ok(Math.abs(result[0].accuracy - 0) < 1e-9);
});

test("detectActivationGaps: does not flag words below the reading-known level", () => {
  const result = detectActivationGaps([
    candidate({
      readingLevel: 2,
      reviewGrades: [
        { grade: 0, reviewedAt: "2026-07-01" },
        { grade: 0, reviewedAt: "2026-07-15" },
        { grade: 0, reviewedAt: "2026-08-01" },
      ],
    }),
  ]);
  assert.equal(result.length, 0);
});

test("detectActivationGaps: does not flag with fewer than the minimum review attempts", () => {
  const result = detectActivationGaps([
    candidate({
      reviewGrades: [
        { grade: 0, reviewedAt: "2026-07-01" },
        { grade: 0, reviewedAt: "2026-07-15" },
      ],
    }),
  ]);
  assert.equal(result.length, 0);
});

test("detectActivationGaps: does not flag a word with good review accuracy", () => {
  const result = detectActivationGaps([
    candidate({
      reviewGrades: [
        { grade: 2, reviewedAt: "2026-07-01" },
        { grade: 3, reviewedAt: "2026-07-15" },
        { grade: 2, reviewedAt: "2026-08-01" },
      ],
    }),
  ]);
  assert.equal(result.length, 0);
});

test("detectActivationGaps: sorts worst accuracy first", () => {
  const okGrades = [
    { grade: 0, reviewedAt: "2026-07-01" },
    { grade: 2, reviewedAt: "2026-07-15" },
    { grade: 0, reviewedAt: "2026-08-01" },
  ];
  const worseGrades = [
    { grade: 0, reviewedAt: "2026-07-01" },
    { grade: 0, reviewedAt: "2026-07-15" },
    { grade: 0, reviewedAt: "2026-08-01" },
  ];
  const result = detectActivationGaps([
    candidate({ vocabularyItemId: "v1", headword: "better-ish", reviewGrades: okGrades }),
    candidate({ vocabularyItemId: "v2", headword: "worst", reviewGrades: worseGrades }),
  ]);
  assert.equal(result[0].headword, "worst");
});
