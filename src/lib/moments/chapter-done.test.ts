import { test } from "node:test";
import assert from "node:assert/strict";
import { chapterExcerpt, comprehensionPercent } from "./chapter-done.ts";

test("comprehensionPercent(): no lookups → 100", () => {
  assert.equal(comprehensionPercent("The old keeper climbed the stairs.", 0), 100);
});

test("comprehensionPercent(): lookups are counted against unique words", () => {
  // уникальных слов: the, old, keeper, climbed, stairs = 5
  assert.equal(comprehensionPercent("The old keeper climbed the stairs.", 1), 80);
});

test("comprehensionPercent(): more lookups than words clamps to 0, empty text is 0", () => {
  assert.equal(comprehensionPercent("One two.", 9), 0);
  assert.equal(comprehensionPercent("", 0), 0);
});

test("chapterExcerpt(): short text stays whole, long text starts at a sentence", () => {
  assert.equal(chapterExcerpt("Short end."), "Short end.");
  const long = "A".repeat(300) + ". She was reluctant to leave the lighthouse. Below, the boat was waiting.";
  const ex = chapterExcerpt(long, 90);
  assert.ok(ex.startsWith("She was reluctant"), ex);
});
