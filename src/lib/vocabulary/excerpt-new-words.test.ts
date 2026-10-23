import { test } from "node:test";
import assert from "node:assert/strict";
import { excerptWithNewWords } from "./text-familiarity.ts";

const BODY = "The old keeper climbed the winding stairs. She was reluctant to leave the light. Then a long third sentence that should not fit into the excerpt at all.";

test("excerptWithNewWords(): keeps text verbatim and stops before the sentence that overflows", () => {
  const tokens = excerptWithNewWords(BODY, [], 90);
  assert.equal(tokens.map((t) => t.text).join(""), "The old keeper climbed the winding stairs. She was reluctant to leave the light.");
});

test("excerptWithNewWords(): marks only unknown words of 4+ letters, at most maxMarks", () => {
  const tokens = excerptWithNewWords(BODY, ["climbed", "OLD"], 90, 3);
  assert.deepEqual(
    tokens.filter((t) => t.isNew).map((t) => t.text),
    ["keeper", "winding", "stairs"],
  );
});

test("excerptWithNewWords(): always returns at least the first sentence", () => {
  const tokens = excerptWithNewWords("A very long first sentence here.", [], 5);
  assert.equal(tokens.map((t) => t.text).join(""), "A very long first sentence here.");
});
