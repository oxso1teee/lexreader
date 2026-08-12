import { test } from "node:test";
import assert from "node:assert/strict";
import { findMatchingMissionForSkill } from "./mission-match.ts";
import type { MissionRow } from "@/lib/missions/types";
import type { Skill } from "./types.ts";

function mission(overrides: Partial<MissionRow> = {}): MissionRow {
  return {
    id: "mission-1",
    user_id: "user-1",
    mission_type: "grammar_pattern",
    source_pattern_id: null,
    source_recommendation_id: null,
    title: "Test mission",
    reason_key: "test",
    skill_category: "article",
    difficulty: "medium",
    estimated_minutes: 4,
    step_count: 5,
    status: "available",
    priority: "medium",
    fingerprint: "fp",
    payload_json: {},
    algorithm_version: 1,
    generated_at: "2026-08-11T00:00:00.000Z",
    started_at: null,
    completed_at: null,
    dismissed_at: null,
    expires_at: "2026-08-18T00:00:00.000Z",
    ...overrides,
  };
}

function skill(overrides: Partial<Skill> = {}): Skill {
  return {
    key: "grammar.articles",
    title: "Articles",
    lesson: { objective: "", explanation: "", examples: [], commonMistakes: [] },
    category: "article",
    ...overrides,
  };
}

test("findMatchingMissionForSkill: matches an available mission by skill_category", () => {
  const match = findMatchingMissionForSkill([mission({ skill_category: "article" })], skill({ category: "article" }));
  assert.equal(match?.skill_category, "article");
});

test("findMatchingMissionForSkill: matches a started mission too, not just available", () => {
  const match = findMatchingMissionForSkill([mission({ status: "started", skill_category: "article" })], skill({ category: "article" }));
  assert.ok(match);
});

test("findMatchingMissionForSkill: ignores completed/dismissed/expired missions", () => {
  const match = findMatchingMissionForSkill(
    [mission({ status: "completed", skill_category: "article" }), mission({ status: "expired", skill_category: "article" })],
    skill({ category: "article" }),
  );
  assert.equal(match, null);
});

test("findMatchingMissionForSkill: no match when no mission shares the category", () => {
  const match = findMatchingMissionForSkill([mission({ skill_category: "passive" })], skill({ category: "article" }));
  assert.equal(match, null);
});

test("findMatchingMissionForSkill: a skill with category null never matches on category", () => {
  const match = findMatchingMissionForSkill([mission({ skill_category: "article" })], skill({ category: null }));
  assert.equal(match, null);
});

test("findMatchingMissionForSkill: missionTypeHint matches by mission_type, ignoring category", () => {
  const phraseMission = mission({ mission_type: "phrase_activation", skill_category: null });
  const match = findMatchingMissionForSkill([phraseMission], skill({ category: null, missionTypeHint: "phrase_activation" }));
  assert.equal(match?.mission_type, "phrase_activation");
});

test("findMatchingMissionForSkill: missionTypeHint never falls back to category matching", () => {
  const match = findMatchingMissionForSkill(
    [mission({ mission_type: "grammar_pattern", skill_category: "article" })],
    skill({ category: "article", missionTypeHint: "phrase_activation" }),
  );
  assert.equal(match, null);
});
