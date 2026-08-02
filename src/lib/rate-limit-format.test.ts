import assert from "node:assert/strict";
import test from "node:test";
import { formatRetryLabel } from "./rate-limit-format.ts";

test("formatRetryLabel(): seconds-only under a minute", () => {
  assert.equal(formatRetryLabel(45), "45 сек");
  assert.equal(formatRetryLabel(1), "1 сек");
});

test("formatRetryLabel(): minutes + zero-padded seconds once past a minute", () => {
  assert.equal(formatRetryLabel(90), "1 мин 30 сек");
  assert.equal(formatRetryLabel(605), "10 мин 05 сек");
});

test("formatRetryLabel(): exact minute boundary shows 00 seconds, not blank", () => {
  assert.equal(formatRetryLabel(120), "2 мин 00 сек");
});
