import { test } from "node:test";
import assert from "node:assert/strict";
import { computeHardestWords, estimateReviewMinutes } from "./brain-stats.ts";

test("computeHardestWords: ranks lowest accuracy first, excludes rows below the attempt floor", () => {
  const logs = [
    // "wander": 1/3 success — below floor alone would exclude it, but it has
    // exactly 3 attempts (the floor), so it counts.
    { flashcard_id: "w1", grade: 0, flashcards: { front: "wander", back: "бродить" } },
    { flashcard_id: "w1", grade: 3, flashcards: { front: "wander", back: "бродить" } },
    { flashcard_id: "w1", grade: 0, flashcards: { front: "wander", back: "бродить" } },
    // "easy": only 2 attempts — below MIN_ATTEMPTS_FOR_ACCURACY (3), excluded
    // even though its accuracy would otherwise look worse.
    { flashcard_id: "e1", grade: 0, flashcards: { front: "easy", back: "легко" } },
    { flashcard_id: "e1", grade: 0, flashcards: { front: "easy", back: "легко" } },
    // "known": 3/3 success — high accuracy, should rank last.
    { flashcard_id: "k1", grade: 3, flashcards: { front: "known", back: "известно" } },
    { flashcard_id: "k1", grade: 3, flashcards: { front: "known", back: "известно" } },
    { flashcard_id: "k1", grade: 3, flashcards: { front: "known", back: "известно" } },
  ];

  const result = computeHardestWords(logs, 10);
  assert.equal(result.length, 2);
  assert.equal(result[0].front, "wander");
  assert.ok(Math.abs(result[0].accuracy - 1 / 3) < 1e-9);
  assert.equal(result[1].front, "known");
});

test("computeHardestWords: respects the limit", () => {
  const logs = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 3 }, () => ({
      flashcard_id: `c${i}`,
      grade: 0,
      flashcards: { front: `w${i}`, back: `b${i}` },
    })),
  ).flat();
  assert.equal(computeHardestWords(logs, 2).length, 2);
});

test("computeHardestWords: ignores rows with a null joined flashcard", () => {
  const logs = [{ flashcard_id: "orphan", grade: 0, flashcards: null }];
  assert.deepEqual(computeHardestWords(logs, 10), []);
});

test("estimateReviewMinutes: rounds to whole minutes, never zero for a non-empty queue", () => {
  assert.equal(estimateReviewMinutes(0), 0);
  assert.equal(estimateReviewMinutes(1), 1); // 20s rounds up to the 1-minute floor
  assert.equal(estimateReviewMinutes(3), 1); // 60s
  assert.equal(estimateReviewMinutes(20), 7); // 400s = 6.67min -> rounds to 7
});
