import { test } from "node:test";
import assert from "node:assert/strict";
import { filterRecallGaps } from "./review-recall.ts";
import type { HardestWord } from "@/lib/brain-stats.ts";

function word(overrides: Partial<HardestWord>): HardestWord {
  return { id: "f1", front: "word", back: "слово", accuracy: 0.3, total: 5, ...overrides };
}

test("filterRecallGaps: keeps only words below the accuracy threshold", () => {
  const result = filterRecallGaps([word({ id: "a", accuracy: 0.3 }), word({ id: "b", accuracy: 0.9 })]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "a");
});

test("filterRecallGaps: excludes ids already covered by another pattern", () => {
  const result = filterRecallGaps(
    [word({ id: "a", accuracy: 0.2 }), word({ id: "b", accuracy: 0.1 })],
    new Set(["a"]),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "b");
});
