import assert from "node:assert/strict";
import test from "node:test";
import { decidePrimaryAction, dueCountBucket, greetingForHour } from "./today.ts";

test("decidePrimaryAction(): due reviews take priority over everything else", () => {
  const action = decidePrimaryAction({
    dueCount: 8,
    continueReading: { textId: "t1", title: "Book", percentRead: 40 },
  });
  assert.deepEqual(action, { type: "review", dueCount: 8 });
});

test("decidePrimaryAction(): no due reviews, has in-progress material -> continue reading", () => {
  const action = decidePrimaryAction({
    dueCount: 0,
    continueReading: { textId: "t1", title: "Book", percentRead: 40 },
  });
  assert.deepEqual(action, { type: "continue_reading", textId: "t1", title: "Book", percentRead: 40 });
});

test("decidePrimaryAction(): no due reviews, no material -> add material (empty state)", () => {
  const action = decidePrimaryAction({ dueCount: 0, continueReading: null });
  assert.deepEqual(action, { type: "add_material" });
});

test("decidePrimaryAction(): negative dueCount treated as zero (defensive)", () => {
  const action = decidePrimaryAction({ dueCount: -1, continueReading: null });
  assert.deepEqual(action, { type: "add_material" });
});

test("dueCountBucket(): buckets match analytics spec ranges", () => {
  assert.equal(dueCountBucket(0), "0");
  assert.equal(dueCountBucket(1), "1-5");
  assert.equal(dueCountBucket(5), "1-5");
  assert.equal(dueCountBucket(6), "6-20");
  assert.equal(dueCountBucket(20), "6-20");
  assert.equal(dueCountBucket(21), "20+");
});

test("greetingForHour(): time-of-day boundaries", () => {
  assert.equal(greetingForHour(0), "Доброй ночи");
  assert.equal(greetingForHour(4), "Доброй ночи");
  assert.equal(greetingForHour(5), "Доброе утро");
  assert.equal(greetingForHour(11), "Доброе утро");
  assert.equal(greetingForHour(12), "Добрый день");
  assert.equal(greetingForHour(17), "Добрый день");
  assert.equal(greetingForHour(18), "Добрый вечер");
  assert.equal(greetingForHour(23), "Добрый вечер");
});
