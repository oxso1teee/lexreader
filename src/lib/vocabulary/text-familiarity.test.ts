import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTextFamiliarity, excerptWithNewWords } from "./text-familiarity.ts";

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

test("inflected forms of a known word count as known (R1)", () => {
  const r = computeTextFamiliarity("She walked home. They walk and walking is fun. Cities grow.", ["walk", "city"]);
  // walked / walk / walking → одно знакомое «walk»; cities → city
  assert.equal(r.knownWordCount, 4);
});

test("a saved inflected form makes its base known", () => {
  const r = computeTextFamiliarity("I study at night.", ["studies"]);
  assert.equal(r.knownWordCount, 1);
});

test("forms are not matched for other languages", () => {
  const r = computeTextFamiliarity("walked", ["walk"], "de");
  assert.equal(r.knownWordCount, 0);
});

test("excerpt does not mark an inflected form of a known word as new", () => {
  const out = excerptWithNewWords("The keepers climbed stairs.", ["keeper", "climb"], 140, 5);
  assert.ok(out.every((t) => !t.isNew || (t.text !== "keepers" && t.text !== "climbed")));
});
