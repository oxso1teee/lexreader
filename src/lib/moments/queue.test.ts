import { test } from "node:test";
import assert from "node:assert/strict";
import { currentBatch, dismiss, emptyQueue, enqueue } from "./queue.ts";
import type { Moment } from "./types.ts";

const week = ["done", "done", "done", "today", "empty", "empty", "empty"] as const;
const goal = (id: string): Moment => ({ kind: "goal_done", id, xpToday: 50, xpGoal: 50, minutesHint: 10, week: [...week] });
const streak = (id: string): Moment => ({ kind: "streak_up", id, streak: 13, week: [...week] });

test("enqueue(): higher-priority kind goes first regardless of arrival order", () => {
  const q = enqueue(emptyQueue(), [streak("s1"), goal("g1")]);
  assert.deepEqual(q.pending.map((m) => m.id), ["g1", "s1"]);
});

test("enqueue(): equal priority keeps arrival order", () => {
  const q = enqueue(emptyQueue(), [streak("a"), streak("b"), streak("c")]);
  assert.deepEqual(q.pending.map((m) => m.id), ["a", "b", "c"]);
});

test("enqueue(): drops ids already pending or already seen", () => {
  let q = enqueue(emptyQueue(["old"]), [goal("old"), goal("g1")]);
  q = enqueue(q, [goal("g1")]);
  assert.deepEqual(q.pending.map((m) => m.id), ["g1"]);
});

test("enqueue(): nothing new returns the same state object", () => {
  const q = enqueue(emptyQueue(["x"]), [goal("y")]);
  assert.equal(enqueue(q, [goal("x"), goal("y")]), q);
});

test("currentBatch(): caps at 3 moments in a row", () => {
  const q = enqueue(emptyQueue(), ["a", "b", "c", "d"].map(streak));
  assert.equal(currentBatch(q).length, 3);
});

test("dismiss(): removes from pending and marks seen, so it never comes back", () => {
  let q = enqueue(emptyQueue(), [goal("g1"), streak("s1")]);
  q = dismiss(q, "g1");
  assert.deepEqual(q.pending.map((m) => m.id), ["s1"]);
  q = enqueue(q, [goal("g1")]);
  assert.deepEqual(q.pending.map((m) => m.id), ["s1"]);
});
