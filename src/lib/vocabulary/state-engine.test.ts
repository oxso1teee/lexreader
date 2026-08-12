import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveVocabularyState, type ReviewSignal } from "./state-engine.ts";

function reviews(...specs: Array<[number, ReviewSignal["mode"]]>): ReviewSignal[] {
  return specs.map(([grade, mode]) => ({ grade, mode }));
}

test("deriveVocabularyState: no reviews is new", () => {
  assert.equal(deriveVocabularyState({ recentReviews: [], intervalDays: null, fsrsStability: null }), "new");
});

test("deriveVocabularyState: a single typed success does not over-promote to active", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, "type"]),
    intervalDays: 1,
    fsrsStability: null,
  });
  assert.equal(state, "familiar");
});

test("deriveVocabularyState: two typed successes with no failures promotes to active", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([3, "type"], [2, "cards"]),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.equal(state, "active");
});

test("deriveVocabularyState: active tolerates one failure in the window (hysteresis)", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([0, "type"], [3, "type"], [2, "cards"]),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.equal(state, "active");
});

test("deriveVocabularyState: active demotes one tier (not to learning) when failures exceed one — 2 real recall successes are still real evidence", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([0, "type"], [0, "cards"], [3, "type"], [2, "cards"]),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.notEqual(state, "active");
  assert.equal(state, "familiar");
});

test("deriveVocabularyState: two recognition-only successes (choice/match) is familiar, not active", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, "choice"], [2, "match"]),
    intervalDays: 3,
    fsrsStability: null,
  });
  assert.equal(state, "familiar");
});

test("deriveVocabularyState: all failures with no successes is learning", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([0, "choice"], [1, "match"], [0, "cards"]),
    intervalDays: 1,
    fsrsStability: null,
  });
  assert.equal(state, "learning");
});

test("deriveVocabularyState: long stable interval with zero recent failures is maintenance", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, "cards"], [3, "cards"], [2, "type"], [3, "cards"], [2, "cards"]),
    intervalDays: 90,
    fsrsStability: null,
  });
  assert.equal(state, "maintenance");
});

test("deriveVocabularyState: long interval does not override a recent failure", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([0, "cards"], [3, "cards"], [2, "type"], [3, "cards"], [2, "cards"]),
    intervalDays: 90,
    fsrsStability: null,
  });
  assert.notEqual(state, "maintenance");
});

test("deriveVocabularyState: high FSRS stability alone (no interval) also qualifies for maintenance", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, "cards"], [3, "cards"], [2, "type"], [3, "cards"], [2, "cards"]),
    intervalDays: null,
    fsrsStability: 75,
  });
  assert.equal(state, "maintenance");
});

test("deriveVocabularyState: fewer than 5 reviews never reaches maintenance even if stable", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, "cards"], [3, "cards"], [2, "type"]),
    intervalDays: 90,
    fsrsStability: null,
  });
  assert.notEqual(state, "maintenance");
});

test("deriveVocabularyState: historical reviews with null mode never count as recall or recognition evidence", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, null], [3, null], [2, null], [2, null]),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.notEqual(state, "active");
  assert.notEqual(state, "familiar");
  assert.equal(state, "learning");
});

test("deriveVocabularyState: null-mode reviews still count toward failures and the maintenance interval check", () => {
  const state = deriveVocabularyState({
    recentReviews: reviews([2, null], [2, null], [2, null], [2, null], [2, null]),
    intervalDays: 90,
    fsrsStability: null,
  });
  assert.equal(state, "maintenance");
});

test("deriveVocabularyState: only the most recent EVIDENCE_WINDOW (6) reviews are considered", () => {
  // 7th-oldest review is a single old failure that should be pushed out of the window entirely,
  // leaving 6 clean typed successes — still active, not demoted by evidence outside the window.
  const state = deriveVocabularyState({
    recentReviews: reviews(
      [3, "type"],
      [2, "cards"],
      [3, "type"],
      [2, "cards"],
      [3, "type"],
      [2, "cards"],
      [0, "type"], // 7th, outside the window
    ),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.equal(state, "active");
});

test("deriveVocabularyState: a failure at exactly the window boundary (7th review) is excluded", () => {
  const withinWindow = deriveVocabularyState({
    recentReviews: reviews([0, "type"], [3, "type"], [2, "cards"], [3, "type"], [2, "cards"], [3, "type"]),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.equal(withinWindow, "active");

  const twoFailuresInWindow = deriveVocabularyState({
    recentReviews: reviews([0, "type"], [0, "cards"], [3, "type"], [2, "cards"], [3, "type"], [2, "cards"]),
    intervalDays: 5,
    fsrsStability: null,
  });
  assert.notEqual(twoFailuresInWindow, "active");
});
