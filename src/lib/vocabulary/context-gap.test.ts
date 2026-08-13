import { test } from "node:test";
import assert from "node:assert/strict";
import { findUnambiguousContextMatch, buildContextGapBlank } from "./context-gap.ts";

test("findUnambiguousContextMatch: finds a single whole-word occurrence", () => {
  const match = findUnambiguousContextMatch("bird", "The bird flew away.");
  assert.deepEqual(match, { start: 4, end: 8 });
});

test("findUnambiguousContextMatch: is case-insensitive", () => {
  const match = findUnambiguousContextMatch("bird", "Bird watching is fun.");
  assert.deepEqual(match, { start: 0, end: 4 });
});

test("findUnambiguousContextMatch: matches a multi-word phrase as one run", () => {
  const match = findUnambiguousContextMatch("take care of", "Please take care of the dog.");
  assert.deepEqual(match, { start: 7, end: 19 });
});

test("findUnambiguousContextMatch: returns null when the word never appears", () => {
  assert.equal(findUnambiguousContextMatch("bird", "The cat slept."), null);
});

test("findUnambiguousContextMatch: returns null when the word appears more than once (ambiguous)", () => {
  assert.equal(findUnambiguousContextMatch("bird", "The bird saw another bird."), null);
});

test("findUnambiguousContextMatch: does not match a substring inside a longer word", () => {
  assert.equal(findUnambiguousContextMatch("cat", "The category is wrong."), null);
});

test("findUnambiguousContextMatch: handles regex-special characters in front safely", () => {
  const match = findUnambiguousContextMatch("don't", "I don't know.");
  assert.deepEqual(match, { start: 2, end: 7 });
});

test("findUnambiguousContextMatch: respects unicode letter boundaries", () => {
  const match = findUnambiguousContextMatch("café", "We sat at the café for hours.");
  assert.deepEqual(match, { start: 14, end: 18 });
});

test("findUnambiguousContextMatch: returns null for empty front or empty context", () => {
  assert.equal(findUnambiguousContextMatch("", "The bird flew away."), null);
  assert.equal(findUnambiguousContextMatch("bird", ""), null);
});

test("buildContextGapBlank: splits the sentence around the single match, preserving original casing", () => {
  const blank = buildContextGapBlank("bird", "The Bird flew away.");
  assert.deepEqual(blank, { before: "The ", blanked: "Bird", after: " flew away." });
});

test("buildContextGapBlank: returns null when the match is ambiguous", () => {
  assert.equal(buildContextGapBlank("bird", "The bird saw another bird."), null);
});
