import { test } from "node:test";
import assert from "node:assert/strict";
import { daysSinceLastActive } from "./days-since.ts";

test("null last_active_date -> 0", () => {
  assert.equal(daysSinceLastActive(null), 0);
});

test("same day -> 0", () => {
  assert.equal(daysSinceLastActive("2026-10-20", new Date("2026-10-20T15:00:00Z")), 0);
});

test("3 days ago -> 3", () => {
  assert.equal(daysSinceLastActive("2026-10-17", new Date("2026-10-20T08:00:00Z")), 3);
});

test("time-of-day on either side does not affect the day count", () => {
  assert.equal(daysSinceLastActive("2026-10-17", new Date("2026-10-20T23:59:59Z")), 3);
});
