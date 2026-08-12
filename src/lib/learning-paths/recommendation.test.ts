import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendPath } from "./recommendation.ts";

test("recommendPath: low behavioral level ranges recommend a2-b1, high confidence", () => {
  assert.equal(recommendPath("A1–A2").pathSlug, "a2-b1");
  assert.equal(recommendPath("A1–A2").lowConfidence, false);
  assert.equal(recommendPath("A2–B1").pathSlug, "a2-b1");
});

test("recommendPath: higher behavioral level ranges recommend b1-b2, high confidence", () => {
  assert.equal(recommendPath("B1–B2").pathSlug, "b1-b2");
  assert.equal(recommendPath("B2+").pathSlug, "b1-b2");
  assert.equal(recommendPath("B2+").lowConfidence, false);
});

test("recommendPath: no data (new user) falls back to a2-b1 with lowConfidence: true", () => {
  const result = recommendPath(null);
  assert.equal(result.pathSlug, "a2-b1");
  assert.equal(result.lowConfidence, true);
});
