import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COOLDOWN_COMPLETED_MS,
  COOLDOWN_DISMISSED_MS,
  MAX_ACTIVE_MISSIONS,
  isUnderCooldown,
  pickHeroMission,
  priorityForCandidate,
  scoreCandidate,
  selectMissionCandidates,
  type FingerprintedCandidate,
} from "./ranking.ts";
import type { MissionCandidateInput, MissionHistoryEntry, MissionRow } from "./types.ts";

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

function mission(overrides: Partial<MissionRow> = {}): MissionRow {
  return {
    id: "mission-1",
    user_id: "user-1",
    mission_type: "grammar_pattern",
    source_pattern_id: null,
    source_recommendation_id: null,
    title: "Test mission",
    reason_key: "test",
    skill_category: "tense",
    difficulty: "medium",
    estimated_minutes: 4,
    step_count: 5,
    status: "available",
    priority: "medium",
    fingerprint: "fp",
    payload_json: {},
    algorithm_version: 1,
    generated_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    dismissed_at: null,
    expires_at: new Date().toISOString(),
    ...overrides,
  };
}

test("pickHeroMission: empty list returns null (no fabricated hero)", () => {
  assert.equal(pickHeroMission([]), null);
});

test("pickHeroMission: a started mission always wins over any available one", () => {
  const started = mission({ id: "started", status: "started", priority: "low" });
  const available = mission({ id: "available", status: "available", priority: "high" });
  assert.equal(pickHeroMission([available, started])?.id, "started");
});

test("pickHeroMission: among available missions, higher priority wins", () => {
  const low = mission({ id: "low", status: "available", priority: "low" });
  const high = mission({ id: "high", status: "available", priority: "high" });
  assert.equal(pickHeroMission([low, high])?.id, "high");
});

test("pickHeroMission: ties broken by most recently generated", () => {
  const older = mission({ id: "older", status: "available", priority: "medium", generated_at: new Date(Date.now() - 60_000).toISOString() });
  const newer = mission({ id: "newer", status: "available", priority: "medium", generated_at: new Date().toISOString() });
  assert.equal(pickHeroMission([older, newer])?.id, "newer");
});

test("pickHeroMission: among multiple started missions, most recently generated wins", () => {
  const older = mission({ id: "older", status: "started", generated_at: new Date(Date.now() - 60_000).toISOString() });
  const newer = mission({ id: "newer", status: "started", generated_at: new Date().toISOString() });
  assert.equal(pickHeroMission([older, newer])?.id, "newer");
});

test("pickHeroMission: dismissed/completed/expired missions are never picked", () => {
  const done = mission({ id: "done", status: "completed" });
  const dismissed = mission({ id: "dismissed", status: "dismissed" });
  assert.equal(pickHeroMission([done, dismissed]), null);
});
