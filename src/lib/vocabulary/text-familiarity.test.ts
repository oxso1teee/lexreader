import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTextFamiliarity } from "./text-familiarity.ts";

const BODY = "The old keeper climbed the winding stairs. She was reluctant to leave the light.";

test("no known words -> 0% familiar, all unique words new", () => {
  const r = computeTextFamiliarity(BODY, []);
  assert.equal(r.knownWordCount, 0);
  assert.equal(r.percentFamiliar, 0);
  assert.equal(r.newWordCount, r.uniqueWordCount);
});

test("known words matched case-insensitively against unique tokens", () => {
  const r = computeTextFamiliarity(BODY, ["The", "old", "KEEPER"]);
  // "the" встречается несколько раз, но считается один уникальный токен.
  assert.equal(r.knownWordCount, 3);
  assert.equal(r.newWordCount, r.uniqueWordCount - 3);
  assert.equal(r.percentFamiliar, Math.round((3 / r.uniqueWordCount) * 100));
});

test("known words not present in the text are ignored", () => {
  const r = computeTextFamiliarity(BODY, ["banana", "spaceship"]);
  assert.equal(r.knownWordCount, 0);
});

test("empty body -> zero counts, no division by zero", () => {
  const r = computeTextFamiliarity("", ["old"]);
  assert.equal(r.uniqueWordCount, 0);
  assert.equal(r.percentFamiliar, 0);
});
