import { test } from "node:test";
import assert from "node:assert/strict";

// This module guards every localStorage access behind `typeof window`, so it
// is safe to import under plain node --test (no jsdom) — but to exercise the
// save/load round-trip we still need a minimal window.localStorage stub.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
}

(globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = {
  localStorage: new MemoryStorage(),
};

const { saveReviewSession, loadReviewSession, clearReviewSession } = await import(
  "./review-session-resume.ts"
);

test("save then load round-trips a valid snapshot", () => {
  saveReviewSession({
    userId: "u1",
    deckId: "d1",
    cardIds: ["c1", "c2", "c3"],
    gradedIds: ["c1"],
    index: 1,
    phase: "question",
  });
  const loaded = loadReviewSession("u1", "d1");
  assert.ok(loaded);
  assert.equal(loaded?.index, 1);
  assert.deepEqual(loaded?.gradedIds, ["c1"]);
  clearReviewSession();
});

test("loadReviewSession returns null for a different user (mismatch protection)", () => {
  saveReviewSession({
    userId: "u1",
    deckId: "d1",
    cardIds: ["c1", "c2"],
    gradedIds: [],
    index: 0,
    phase: "question",
  });
  assert.equal(loadReviewSession("someone-else"), null);
  clearReviewSession();
});

test("loadReviewSession returns null for a different deck", () => {
  saveReviewSession({
    userId: "u1",
    deckId: "d1",
    cardIds: ["c1", "c2"],
    gradedIds: [],
    index: 0,
    phase: "question",
  });
  assert.equal(loadReviewSession("u1", "d2"), null);
  clearReviewSession();
});

test("loadReviewSession returns null once index reaches the end (completed session)", () => {
  saveReviewSession({
    userId: "u1",
    deckId: "d1",
    cardIds: ["c1", "c2"],
    gradedIds: ["c1", "c2"],
    index: 2,
    phase: "question",
  });
  assert.equal(loadReviewSession("u1", "d1"), null);
  clearReviewSession();
});

test("loadReviewSession returns null for a stale (>6h old) session", () => {
  const stale = {
    userId: "u1",
    deckId: "d1",
    cardIds: ["c1", "c2"],
    gradedIds: [],
    index: 0,
    phase: "question",
    updatedAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  };
  (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.setItem(
    "lexreader_review_session_v1",
    JSON.stringify(stale),
  );
  assert.equal(loadReviewSession("u1", "d1"), null);
  clearReviewSession();
});

test("loadReviewSession returns null for corrupted JSON", () => {
  (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.setItem(
    "lexreader_review_session_v1",
    "{not valid json",
  );
  assert.equal(loadReviewSession("u1", "d1"), null);
  clearReviewSession();
});

test("loadReviewSession returns null for a shape missing required fields", () => {
  (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window.localStorage.setItem(
    "lexreader_review_session_v1",
    JSON.stringify({ userId: "u1" }),
  );
  assert.equal(loadReviewSession("u1"), null);
  clearReviewSession();
});

test("clearReviewSession removes the stored session", () => {
  saveReviewSession({
    userId: "u1",
    deckId: "d1",
    cardIds: ["c1"],
    gradedIds: [],
    index: 0,
    phase: "question",
  });
  clearReviewSession();
  assert.equal(loadReviewSession("u1", "d1"), null);
});
