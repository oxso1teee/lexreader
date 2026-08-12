import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyKnowledgeCheckResult,
  applyLessonCompletion,
  applyPracticeEvidence,
  blendConfidence,
  countSkillsByStatus,
  courseProgressPercent,
  emptySkillProgress,
  findCurrentFocusSkill,
  isPathComplete,
  scoreKnowledgeCheck,
  stageStatus,
} from "./progress-engine.ts";
import { getAllSkills, getPath } from "./curriculum/index.ts";
import type { SkillProgressRow } from "./types.ts";

const NOW = "2026-08-11T12:00:00.000Z";
const path = getPath("a2-b1")!;
const firstSkillKey = getAllSkills(path)[0].key;

function baseProgress(overrides: Partial<SkillProgressRow> = {}): SkillProgressRow {
  return {
    id: "row-1",
    user_id: "user-1",
    path_slug: "a2-b1",
    path_version: 1,
    skill_key: firstSkillKey,
    status: "not_started",
    evidence_count: 0,
    confidence: "low",
    content_completed_at: null,
    last_practiced_at: null,
    knowledge_check_best_score: null,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

test("emptySkillProgress: starts not_started/low with no evidence", () => {
  const p = emptySkillProgress("user-1", path, firstSkillKey);
  assert.equal(p.status, "not_started");
  assert.equal(p.confidence, "low");
  assert.equal(p.evidence_count, 0);
  assert.equal(p.content_completed_at, null);
});

test("applyLessonCompletion: not_started -> introduced, sets content_completed_at, never touches confidence", () => {
  const patch = applyLessonCompletion(baseProgress(), NOW);
  assert.equal(patch.status, "introduced");
  assert.equal(patch.content_completed_at, NOW);
  assert.equal(patch.confidence, undefined);
});

test("applyLessonCompletion: re-completing an already-completed lesson is a no-op on content_completed_at", () => {
  const already = baseProgress({ status: "practicing", content_completed_at: "2026-01-01T00:00:00.000Z" });
  const patch = applyLessonCompletion(already, NOW);
  assert.equal(patch.content_completed_at, "2026-01-01T00:00:00.000Z");
  assert.equal(patch.status, undefined);
});

test("scoreKnowledgeCheck: buckets strong/mixed/weak at the documented thresholds", () => {
  assert.equal(scoreKnowledgeCheck(4, 5).bucket, "strong"); // 0.8
  assert.equal(scoreKnowledgeCheck(3, 5).bucket, "mixed"); // 0.6
  assert.equal(scoreKnowledgeCheck(2, 5).bucket, "weak"); // 0.4
  assert.equal(scoreKnowledgeCheck(0, 0).bucket, "weak");
});

test("applyKnowledgeCheckResult: strong result marks confident/high and content-completes", () => {
  const outcome = scoreKnowledgeCheck(5, 5);
  const patch = applyKnowledgeCheckResult(baseProgress(), outcome, NOW);
  assert.equal(patch.status, "confident");
  assert.equal(patch.confidence, "high");
  assert.equal(patch.content_completed_at, NOW);
  assert.equal(patch.knowledge_check_best_score, 1);
});

test("applyKnowledgeCheckResult: mixed result moves introduced -> practicing, never jumps to confident", () => {
  const outcome = scoreKnowledgeCheck(3, 5);
  const patch = applyKnowledgeCheckResult(baseProgress({ status: "introduced" }), outcome, NOW);
  assert.equal(patch.status, "practicing");
  assert.notEqual(patch.status, "confident");
});

test("applyKnowledgeCheckResult: weak result stays/reverts to introduced even from a higher prior status", () => {
  const outcome = scoreKnowledgeCheck(1, 5);
  const patch = applyKnowledgeCheckResult(baseProgress({ status: "practicing" }), outcome, NOW);
  assert.equal(patch.status, "introduced");
});

test("applyKnowledgeCheckResult: knowledge_check_best_score is monotonic, never decreases on a worse retake", () => {
  const strongFirst = baseProgress({ knowledge_check_best_score: 0.9 });
  const weakRetake = scoreKnowledgeCheck(1, 5);
  const patch = applyKnowledgeCheckResult(strongFirst, weakRetake, NOW);
  assert.equal(patch.knowledge_check_best_score, 0.9);
});

test("applyPracticeEvidence: a single click never marks a skill confident", () => {
  const patch = applyPracticeEvidence(baseProgress(), NOW);
  assert.notEqual(patch.status, "confident");
  assert.equal(patch.evidence_count, 1);
});

test("applyPracticeEvidence: not_started -> practicing after 1 evidence, -> improving after 3", () => {
  const first = applyPracticeEvidence(baseProgress(), NOW);
  assert.equal(first.status, "practicing");
  const third = applyPracticeEvidence(baseProgress({ evidence_count: 2, status: "practicing" }), NOW);
  assert.equal(third.status, "improving");
});

test("applyPracticeEvidence: practicing after mastery only updates evidence/recency, never demotes status/confidence", () => {
  const mastered = baseProgress({ status: "confident", confidence: "high", evidence_count: 10 });
  const patch = applyPracticeEvidence(mastered, NOW);
  assert.equal(patch.status, undefined);
  assert.equal(patch.confidence, undefined);
  assert.equal(patch.evidence_count, 11);
});

test("blendConfidence: Language Twin signal only ever raises, never lowers, the skill's own confidence", () => {
  assert.equal(blendConfidence("low", "high"), "high");
  assert.equal(blendConfidence("high", "low"), "high");
  assert.equal(blendConfidence("medium", null), "medium");
});

test("courseProgressPercent: 0% with no progress rows, 100% when every skill is content-completed", () => {
  assert.equal(courseProgressPercent(path, []), 0);
  const allSkills = getAllSkills(path);
  const rows = allSkills.map((s) => baseProgress({ skill_key: s.key, content_completed_at: NOW }));
  assert.equal(courseProgressPercent(path, rows), 100);
});

test("courseProgressPercent: is independent of confidence — a completed-but-not-confident skill still counts", () => {
  const rows = [baseProgress({ skill_key: firstSkillKey, content_completed_at: NOW, status: "introduced", confidence: "low" })];
  const pct = courseProgressPercent(path, rows);
  assert.ok(pct > 0);
});

test("countSkillsByStatus: counts only the requested statuses", () => {
  const rows = [
    baseProgress({ skill_key: firstSkillKey, status: "confident" }),
    baseProgress({ skill_key: getAllSkills(path)[1].key, status: "practicing" }),
  ];
  assert.equal(countSkillsByStatus(path, rows, ["confident"]), 1);
  assert.equal(countSkillsByStatus(path, rows, ["confident", "practicing"]), 2);
});

test("findCurrentFocusSkill: with no progress, the very first curriculum skill", () => {
  const focus = findCurrentFocusSkill(path, []);
  assert.equal(focus?.key, firstSkillKey);
});

test("findCurrentFocusSkill: skips confident/maintenance skills, returns null when the whole path is mastered", () => {
  const allSkills = getAllSkills(path);
  const rows = allSkills.map((s) => baseProgress({ skill_key: s.key, status: "confident" }));
  assert.equal(findCurrentFocusSkill(path, rows), null);

  const partialRows = [baseProgress({ skill_key: firstSkillKey, status: "confident" })];
  assert.equal(findCurrentFocusSkill(path, partialRows)?.key, allSkills[1].key);
});

test("isPathComplete: false until every skill has content_completed_at, true once they all do", () => {
  const allSkills = getAllSkills(path);
  assert.equal(isPathComplete(path, []), false);
  const rows = allSkills.map((s) => baseProgress({ skill_key: s.key, content_completed_at: NOW }));
  assert.equal(isPathComplete(path, rows), true);
});

test("stageStatus: an untouched stage with no focus skill in it is upcoming", () => {
  const lastStage = path.stages[path.stages.length - 1];
  assert.equal(stageStatus(lastStage, [], firstSkillKey), "upcoming");
});

test("stageStatus: the stage containing the current focus skill is current", () => {
  const firstStage = path.stages[0];
  assert.equal(stageStatus(firstStage, [], firstSkillKey), "current");
});

test("stageStatus: a stage is completed only once every skill in it has content_completed_at", () => {
  const firstStage = path.stages[0];
  const skillsInStage = firstStage.modules.flatMap((m) => m.skills);
  const rows = skillsInStage.map((s) => baseProgress({ skill_key: s.key, content_completed_at: NOW }));
  assert.equal(stageStatus(firstStage, rows, null), "completed");

  const partialRows = rows.slice(0, -1);
  assert.equal(stageStatus(firstStage, partialRows, null), "current");
});
