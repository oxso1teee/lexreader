import assert from "node:assert/strict";
import test from "node:test";
import { formatCountdown, formatRetryLabel } from "./rate-limit-format.ts";

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

test("formatCountdown(): m:ss как в макете («0:42»), секунды с нулём", () => {
  assert.equal(formatCountdown(42), "0:42");
  assert.equal(formatCountdown(60), "1:00");
  assert.equal(formatCountdown(65), "1:05");
  assert.equal(formatCountdown(9), "0:09");
  assert.equal(formatCountdown(0), "0:00");
});

test("formatCountdown(): отрицательные и дробные значения не дают мусора", () => {
  assert.equal(formatCountdown(-3), "0:00");
  assert.equal(formatCountdown(41.9), "0:41");
});
