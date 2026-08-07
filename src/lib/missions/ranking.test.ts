import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COOLDOWN_COMPLETED_MS,
  COOLDOWN_DISMISSED_MS,
  MAX_ACTIVE_MISSIONS,
  isUnderCooldown,
  priorityForCandidate,
  scoreCandidate,
  selectMissionCandidates,
  type FingerprintedCandidate,
} from "./ranking.ts";
import type { MissionCandidateInput, MissionHistoryEntry } from "./types.ts";

function candidate(overrides: Partial<MissionCandidateInput> = {}): MissionCandidateInput {
  return {
    missionType: "grammar_pattern",
    sourcePatternId: "pattern-1",
    sourceRecommendationId: null,
    skillCategory: "tense",
    severity: "medium",
    confidence: "medium",
    trend: "flat",
    evidenceCount: 3,
    updatedAt: new Date().toISOString(),
    title: "Test pattern",
    reasonKey: "test",
    ...overrides,
  };
}

test("isUnderCooldown: completed recently blocks regeneration", () => {
  const now = new Date();
  const entry: MissionHistoryEntry = {
    fingerprint: "fp",
    status: "completed",
    completedAt: new Date(now.getTime() - COOLDOWN_COMPLETED_MS / 2).toISOString(),
    dismissedAt: null,
  };
  assert.equal(isUnderCooldown(entry, now), true);
});

test("isUnderCooldown: completed past the 12h window is clear", () => {
  const now = new Date();
  const entry: MissionHistoryEntry = {
    fingerprint: "fp",
    status: "completed",
    completedAt: new Date(now.getTime() - COOLDOWN_COMPLETED_MS - 1000).toISOString(),
    dismissedAt: null,
  };
  assert.equal(isUnderCooldown(entry, now), false);
});

test("isUnderCooldown: dismissed recently blocks regeneration for 48h", () => {
  const now = new Date();
  const entry: MissionHistoryEntry = {
    fingerprint: "fp",
    status: "dismissed",
    completedAt: null,
    dismissedAt: new Date(now.getTime() - COOLDOWN_DISMISSED_MS / 2).toISOString(),
  };
  assert.equal(isUnderCooldown(entry, now), true);
});

test("isUnderCooldown: dismissed past the 48h window is clear", () => {
  const now = new Date();
  const entry: MissionHistoryEntry = {
    fingerprint: "fp",
    status: "dismissed",
    completedAt: null,
    dismissedAt: new Date(now.getTime() - COOLDOWN_DISMISSED_MS - 1000).toISOString(),
  };
  assert.equal(isUnderCooldown(entry, now), false);
});

test("scoreCandidate: higher severity and confidence score higher", () => {
  const now = new Date();
  const weak = scoreCandidate(candidate({ severity: "low", confidence: "low" }), 4, now);
  const strong = scoreCandidate(candidate({ severity: "high", confidence: "high" }), 4, now);
  assert.ok(strong > weak);
});

test("scoreCandidate: recently-touched pattern gets a recency bonus", () => {
  const now = new Date();
  const recent = scoreCandidate(candidate({ updatedAt: now.toISOString() }), 4, now);
  const stale = scoreCandidate(candidate({ updatedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString() }), 4, now);
  assert.ok(recent > stale);
});

test("scoreCandidate: long missions score lower than short ones, all else equal", () => {
  const now = new Date();
  const short = scoreCandidate(candidate(), 3, now);
  const long = scoreCandidate(candidate(), 8, now);
  assert.ok(short > long);
});

test("priorityForCandidate: high severity + non-low confidence is high priority", () => {
  assert.equal(priorityForCandidate(candidate({ severity: "high", confidence: "medium" })), "high");
});

test("priorityForCandidate: low confidence is always low priority (never a false diagnosis)", () => {
  assert.equal(priorityForCandidate(candidate({ severity: "high", confidence: "low" })), "low");
});

test("priorityForCandidate: improving trend is low priority (maintenance, not urgent)", () => {
  assert.equal(priorityForCandidate(candidate({ severity: "medium", confidence: "medium", trend: "up" })), "low");
});

function fp(c: MissionCandidateInput, fingerprint: string, minutes = 4): FingerprintedCandidate {
  return { candidate: c, fingerprint, estimatedMinutes: minutes };
}

test("selectMissionCandidates: caps at MAX_ACTIVE_MISSIONS even with many candidates", () => {
  const candidates = Array.from({ length: 10 }, (_, i) =>
    fp(candidate({ sourcePatternId: `pattern-${i}` }), `fp-${i}`),
  );
  const selected = selectMissionCandidates(candidates, [], new Date());
  assert.equal(selected.length, MAX_ACTIVE_MISSIONS);
});

test("selectMissionCandidates: never selects two missions for the same source_pattern_id", () => {
  const candidates = [
    fp(candidate({ sourcePatternId: "pattern-1", missionType: "grammar_pattern" }), "fp-a"),
    fp(candidate({ sourcePatternId: "pattern-1", missionType: "correction" }), "fp-b"),
    fp(candidate({ sourcePatternId: "pattern-2" }), "fp-c"),
  ];
  const selected = selectMissionCandidates(candidates, [], new Date());
  const patternIds = selected.map((s) => s.candidate.sourcePatternId);
  assert.equal(new Set(patternIds).size, patternIds.length);
});

test("selectMissionCandidates: excludes a fingerprint under cooldown entirely", () => {
  const now = new Date();
  const candidates = [fp(candidate({ sourcePatternId: "pattern-1" }), "fp-cooldown")];
  const history: MissionHistoryEntry[] = [
    { fingerprint: "fp-cooldown", status: "completed", completedAt: now.toISOString(), dismissedAt: null },
  ];
  const selected = selectMissionCandidates(candidates, history, now);
  assert.equal(selected.length, 0);
});

test("selectMissionCandidates: no candidates and no history produces no missions (honest empty state)", () => {
  assert.deepEqual(selectMissionCandidates([], [], new Date()), []);
});

test("selectMissionCandidates: higher-scoring candidate is selected first when only one slot fits under the pattern rule", () => {
  const now = new Date();
  const candidates = [
    fp(candidate({ sourcePatternId: "p1", severity: "low", confidence: "low" }), "fp-weak"),
    fp(candidate({ sourcePatternId: "p2", severity: "high", confidence: "high" }), "fp-strong"),
  ];
  const selected = selectMissionCandidates(candidates, [], now);
  assert.equal(selected[0].fingerprint, "fp-strong");
});
