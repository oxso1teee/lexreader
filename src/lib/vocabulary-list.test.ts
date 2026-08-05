import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketFor } from "./vocabulary-list.ts";

test("bucketFor: never-reviewed card is 'new' regardless of due_at/repetitions", () => {
  assert.equal(bucketFor(null, new Date(Date.now() - 1000).toISOString(), 5, 30), "new");
});

test("bucketFor: reviewed card with due_at in the past is 'due'", () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  assert.equal(bucketFor("2026-01-01T00:00:00Z", past, 1, 5), "due");
});

test("bucketFor: reviewed, not due, below the isLearned threshold is 'learning'", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(bucketFor("2026-01-01T00:00:00Z", future, 1, 5), "learning");
});

test("bucketFor: reviewed, not due, meets isLearned threshold (interval>=21, reps>=3) is 'known'", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(bucketFor("2026-01-01T00:00:00Z", future, 3, 21), "known");
});

test("bucketFor: due_at exactly now counts as due (<=), not learning/known", () => {
  const now = new Date().toISOString();
  assert.equal(bucketFor("2026-01-01T00:00:00Z", now, 5, 100), "due");
});
