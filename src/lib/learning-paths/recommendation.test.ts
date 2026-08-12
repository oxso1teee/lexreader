import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendPath, recommendPathFromPlacement } from "./recommendation.ts";

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

// M3 Slice 9 — recommendPathFromPlacement (plan doc §12), worked examples
// matching the brief's own three scenarios verbatim.
test("recommendPathFromPlacement: goal=everyday, placement=A2–B1 -> primary a2-b1, alternative everyday", () => {
  const r = recommendPathFromPlacement({ placementRange: "A2–B1", placementConfidence: "high", selfReportedCefr: "A2", primaryGoal: "everyday" });
  assert.equal(r.primary, "a2-b1");
  assert.equal(r.alternative, "everyday");
});

test("recommendPathFromPlacement: self-report B2 but placement A1–A2, goal=study -> primary a2-b1 (placement wins), no alternative for study", () => {
  const r = recommendPathFromPlacement({ placementRange: "A1–A2", placementConfidence: "medium", selfReportedCefr: "B2", primaryGoal: "study" });
  assert.equal(r.primary, "a2-b1");
  assert.equal(r.alternative, null);
});

test("recommendPathFromPlacement: skipped placement, self-report B1, goal=work_it -> primary b1-b2, alternative it-english", () => {
  const r = recommendPathFromPlacement({ placementRange: null, placementConfidence: null, selfReportedCefr: "B1", primaryGoal: "work_it" });
  assert.equal(r.primary, "b1-b2");
  assert.equal(r.alternative, "it-english");
});

test("recommendPathFromPlacement: no goal -> no alternative", () => {
  const r = recommendPathFromPlacement({ placementRange: "A2–B1", placementConfidence: "high", selfReportedCefr: "A2", primaryGoal: null });
  assert.equal(r.alternative, null);
});

test("recommendPathFromPlacement: never auto-enrolls -- returns a recommendation only, no side effects", () => {
  const r = recommendPathFromPlacement({ placementRange: "B2+", placementConfidence: "high", selfReportedCefr: "B2", primaryGoal: "travel" });
  assert.equal(typeof r.primary, "string");
  assert.ok(Array.isArray(r.primaryReason));
});
