import assert from "node:assert/strict";
import test from "node:test";
import { skillStatus, SKILL_STATUS_LABEL } from "./skill-status.ts";

test("zero events -> few_data", () => {
  assert.equal(skillStatus(0), "few_data");
});

test("1-4 events -> collecting", () => {
  assert.equal(skillStatus(1), "collecting");
  assert.equal(skillStatus(4), "collecting");
});

test("5+ events -> trending", () => {
  assert.equal(skillStatus(5), "trending");
  assert.equal(skillStatus(1000), "trending");
});

test("negative counts are treated as zero (defensive)", () => {
  assert.equal(skillStatus(-3), "few_data");
});

test("every status has a Russian label, none reference a fabricated CEFR/skill level", () => {
  for (const status of ["few_data", "collecting", "trending"] as const) {
    const label = SKILL_STATUS_LABEL[status];
    assert.ok(label.length > 0);
    assert.doesNotMatch(label, /A1|A2|B1|B2|C1|C2/);
  }
});
