import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMissionFingerprint } from "./fingerprint.ts";

test("buildMissionFingerprint: deterministic for identical inputs", () => {
  const input = {
    missionType: "grammar_pattern" as const,
    sourcePatternId: "pattern-1",
    sourceRecommendationId: null,
    skillCategory: "tense",
    algorithmVersion: 1,
  };
  assert.equal(buildMissionFingerprint(input), buildMissionFingerprint(input));
});

test("buildMissionFingerprint: different pattern ids produce different fingerprints", () => {
  const a = buildMissionFingerprint({
    missionType: "grammar_pattern",
    sourcePatternId: "pattern-1",
    algorithmVersion: 1,
  });
  const b = buildMissionFingerprint({
    missionType: "grammar_pattern",
    sourcePatternId: "pattern-2",
    algorithmVersion: 1,
  });
  assert.notEqual(a, b);
});

test("buildMissionFingerprint: falls back to sourceRecommendationId, then 'generic'", () => {
  const withRec = buildMissionFingerprint({
    missionType: "onboarding",
    sourcePatternId: null,
    sourceRecommendationId: "rec-1",
    algorithmVersion: 1,
  });
  const generic = buildMissionFingerprint({
    missionType: "onboarding",
    sourcePatternId: null,
    sourceRecommendationId: null,
    algorithmVersion: 1,
  });
  assert.notEqual(withRec, generic);
  // two generic onboarding fingerprints (same type/category/version) collide
  // on purpose — only one onboarding mission should ever be active at once.
  const generic2 = buildMissionFingerprint({
    missionType: "onboarding",
    algorithmVersion: 1,
  });
  assert.equal(generic, generic2);
});

test("buildMissionFingerprint: algorithm_version bump changes the fingerprint", () => {
  const v1 = buildMissionFingerprint({ missionType: "grammar_pattern", sourcePatternId: "p1", algorithmVersion: 1 });
  const v2 = buildMissionFingerprint({ missionType: "grammar_pattern", sourcePatternId: "p1", algorithmVersion: 2 });
  assert.notEqual(v1, v2);
});

test("buildMissionFingerprint: skill_category distinguishes otherwise-identical candidates", () => {
  const a = buildMissionFingerprint({ missionType: "correction", sourcePatternId: "p1", skillCategory: "preposition", algorithmVersion: 1 });
  const b = buildMissionFingerprint({ missionType: "correction", sourcePatternId: "p1", skillCategory: "article", algorithmVersion: 1 });
  assert.notEqual(a, b);
});
