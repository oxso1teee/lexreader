import { test } from "node:test";
import assert from "node:assert/strict";
import { ALGORITHM_VERSION, generateMissionDrafts } from "./generator.ts";
import { buildMissionFingerprint } from "./fingerprint.ts";
import type { MissionCandidateInput, MissionHistoryEntry } from "./types.ts";

function candidate(overrides: Partial<MissionCandidateInput> = {}): MissionCandidateInput {
  return {
    missionType: "grammar_pattern",
    sourcePatternId: "pattern-1",
    sourceRecommendationId: null,
    skillCategory: "tense",
    severity: "high",
    confidence: "high",
    trend: "flat",
    evidenceCount: 4,
    updatedAt: new Date().toISOString(),
    title: "Missing auxiliary in Present Continuous",
    reasonKey: "grammar_pattern",
    ...overrides,
  };
}

test("generateMissionDrafts: no candidates produces no missions (no fabricated personalization)", () => {
  assert.deepEqual(generateMissionDrafts([], []), []);
});

test("generateMissionDrafts: is deterministic — identical inputs produce identical output", () => {
  const now = new Date("2026-01-01T12:00:00Z");
  const candidates = [candidate(), candidate({ sourcePatternId: "pattern-2", severity: "medium" })];
  const a = generateMissionDrafts(candidates, [], now);
  const b = generateMissionDrafts(candidates, [], now);
  assert.deepEqual(a, b);
});

test("generateMissionDrafts: produces a real, non-empty title/reasonKey/fingerprint for a real candidate", () => {
  const drafts = generateMissionDrafts([candidate()], []);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].title, "Missing auxiliary in Present Continuous");
  assert.ok(drafts[0].fingerprint.length > 0);
  assert.equal(drafts[0].stepCount, 5);
  assert.equal(drafts[0].estimatedMinutes, 4);
  assert.equal(drafts[0].difficulty, "hard");
  assert.equal(drafts[0].priority, "high");
});

test("generateMissionDrafts: fingerprint matches buildMissionFingerprint with the generator's own algorithm version", () => {
  const drafts = generateMissionDrafts([candidate()], []);
  const expected = buildMissionFingerprint({
    missionType: "grammar_pattern",
    sourcePatternId: "pattern-1",
    sourceRecommendationId: null,
    skillCategory: "tense",
    algorithmVersion: ALGORITHM_VERSION,
  });
  assert.equal(drafts[0].fingerprint, expected);
});

test("generateMissionDrafts: caps at 3 missions even with many strong candidates", () => {
  const candidates = Array.from({ length: 8 }, (_, i) => candidate({ sourcePatternId: `pattern-${i}` }));
  const drafts = generateMissionDrafts(candidates, []);
  assert.equal(drafts.length, 3);
});

test("generateMissionDrafts: a mission completed under cooldown is not regenerated", () => {
  const now = new Date();
  const fingerprint = buildMissionFingerprint({
    missionType: "grammar_pattern",
    sourcePatternId: "pattern-1",
    sourceRecommendationId: null,
    skillCategory: "tense",
    algorithmVersion: ALGORITHM_VERSION,
  });
  const history: MissionHistoryEntry[] = [
    { fingerprint, status: "completed", completedAt: now.toISOString(), dismissedAt: null },
  ];
  const drafts = generateMissionDrafts([candidate()], history, now);
  assert.deepEqual(drafts, []);
});

test("generateMissionDrafts: vocab_activation candidate carries wordIds through into payload", () => {
  const drafts = generateMissionDrafts(
    [candidate({ missionType: "vocab_activation", wordIds: ["card-1", "card-2"] })],
    [],
  );
  assert.deepEqual(drafts[0].payload, { wordIds: ["card-1", "card-2"] });
});

test("generateMissionDrafts: onboarding candidate has no source pattern and an empty payload", () => {
  const drafts = generateMissionDrafts(
    [candidate({ missionType: "onboarding", sourcePatternId: null, skillCategory: null, reasonKey: "onboarding" })],
    [],
  );
  assert.equal(drafts[0].sourcePatternId, null);
  assert.deepEqual(drafts[0].payload, {});
});
