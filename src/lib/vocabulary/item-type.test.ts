import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveItemType, normalizeVocabularyKey } from "./item-type.ts";

test("deriveItemType: single word is 'word'", () => {
  assert.equal(deriveItemType("avoid"), "word");
});

test("deriveItemType: multi-word text is 'phrase'", () => {
  assert.equal(deriveItemType("figure out"), "phrase");
  assert.equal(deriveItemType("at the end of the day"), "phrase");
});

test("deriveItemType: leading/trailing whitespace around a single word is still 'word'", () => {
  assert.equal(deriveItemType("  avoid  "), "word");
});

test("deriveItemType: internal whitespace after trim still makes it a phrase", () => {
  assert.equal(deriveItemType("  figure out  "), "phrase");
});

test("normalizeVocabularyKey: trims and lowercases", () => {
  assert.equal(normalizeVocabularyKey("  Avoid  "), "avoid");
  assert.equal(normalizeVocabularyKey("Figure Out"), "figure out");
});

test("normalizeVocabularyKey: does not over-normalize case-sensitive proper nouns/acronyms beyond lowercasing", () => {
  // Deliberately minimal normalization (plan doc §15) — US vs us collide after lowercasing,
  // same as the pre-existing normalizeFront() in flashcard-dedup.ts. Documented, not "fixed"
  // here — over-aggressive normalization (stripping diacritics, singular/plural folding) is
  // explicitly out of scope.
  assert.equal(normalizeVocabularyKey("US"), normalizeVocabularyKey("us"));
});
