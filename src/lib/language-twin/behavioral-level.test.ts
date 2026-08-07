import { test } from "node:test";
import assert from "node:assert/strict";
import { behavioralLevelRange } from "./behavioral-level.ts";

test("behavioralLevelRange: returns null below the minimum vocabulary floor", () => {
  assert.equal(behavioralLevelRange(5, 0.9), null);
});

test("behavioralLevelRange: larger vocabulary maps to a higher band", () => {
  assert.equal(behavioralLevelRange(4000, 0.8), "B2+");
  assert.equal(behavioralLevelRange(2000, 0.8), "B1–B2");
  assert.equal(behavioralLevelRange(800, 0.8), "A2–B1");
  assert.equal(behavioralLevelRange(50, 0.8), "A1–A2");
});

test("behavioralLevelRange: poor accuracy downshifts the band by one step", () => {
  assert.equal(behavioralLevelRange(4000, 0.3), "B1–B2");
});

test("behavioralLevelRange: unknown accuracy does not downshift", () => {
  assert.equal(behavioralLevelRange(4000, null), "B2+");
});

test("behavioralLevelRange: always returns a range, never a single value", () => {
  const result = behavioralLevelRange(2000, 0.8);
  assert.ok(result && /[–-]|\+/.test(result));
});
