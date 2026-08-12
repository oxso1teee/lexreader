import type { ConfidenceLevel } from "@/lib/language-twin/types";
import type { LearningPath, Skill, SkillConfidence, SkillProgressRow, SkillStatus, Stage } from "./types.ts";
import { getAllSkills } from "./curriculum/index.ts";

// M3 Slice 8 Phase B — deterministic skill progress engine (plan doc §7/§8).
// Pure functions only: every DB read/write lives in persist.ts, every server
// action re-validates ownership before calling in here. No function in this
// file ever marks a skill "confident" from a single lesson-completion click
// (plan doc's "no fake automation" rule) — only applyKnowledgeCheckResult
// (a real, scored check) can do that.

export const KNOWLEDGE_CHECK_STRONG_THRESHOLD = 0.8;
export const KNOWLEDGE_CHECK_MIXED_THRESHOLD = 0.5;
export const PRACTICING_EVIDENCE_THRESHOLD = 1;
export const IMPROVING_EVIDENCE_THRESHOLD = 3;

export function emptySkillProgress(
  userId: string,
  path: LearningPath,
  skillKey: string,
): Omit<SkillProgressRow, "id" | "created_at" | "updated_at"> {
  return {
    user_id: userId,
    path_slug: path.slug,
    path_version: path.version,
    skill_key: skillKey,
    status: "not_started",
    evidence_count: 0,
    confidence: "low",
    content_completed_at: null,
    last_practiced_at: null,
    knowledge_check_best_score: null,
  };
}

type ProgressPatch = Partial<
  Pick<
    SkillProgressRow,
    "status" | "evidence_count" | "confidence" | "content_completed_at" | "last_practiced_at" | "knowledge_check_best_score"
  >
>;

// Lesson completion only ever moves not_started -> introduced. It marks
// content read, never practice/mastery — confidence is untouched (plan doc
// §7's "content completion vs skill confidence, never collapsed").
export function applyLessonCompletion(progress: SkillProgressRow, now: string): ProgressPatch {
  const patch: ProgressPatch = { content_completed_at: progress.content_completed_at ?? now };
  if (progress.status === "not_started") patch.status = "introduced";
  return patch;
}

export interface KnowledgeCheckOutcome {
  scoreRatio: number; // 0..1
  bucket: "strong" | "mixed" | "weak";
}

export function scoreKnowledgeCheck(correct: number, total: number): KnowledgeCheckOutcome {
  const scoreRatio = total > 0 ? correct / total : 0;
  const bucket = scoreRatio >= KNOWLEDGE_CHECK_STRONG_THRESHOLD ? "strong" : scoreRatio >= KNOWLEDGE_CHECK_MIXED_THRESHOLD ? "mixed" : "weak";
  return { scoreRatio, bucket };
}

// Plan doc §8's result buckets, applied to a skill's persisted progress row.
// `best_score` is monotonic (never decreases) — a single bad retake can't
// erase an earlier real result.
export function applyKnowledgeCheckResult(progress: SkillProgressRow, outcome: KnowledgeCheckOutcome, now: string): ProgressPatch {
  const bestScore = Math.max(progress.knowledge_check_best_score ?? 0, outcome.scoreRatio);
  const patch: ProgressPatch = { knowledge_check_best_score: bestScore, last_practiced_at: now };

  if (outcome.bucket === "strong") {
    patch.status = "confident";
    patch.confidence = "high";
    patch.content_completed_at = progress.content_completed_at ?? now;
  } else if (outcome.bucket === "mixed") {
    patch.status = progress.status === "not_started" || progress.status === "introduced" ? "practicing" : progress.status;
    if (progress.confidence === "low") patch.confidence = "medium";
  } else {
    patch.status = "introduced";
  }
  return patch;
}

// A completed Mission/Practice session touching this skill's category —
// sustained evidence, never a jump straight to "confident" (plan doc §45's
// "no fake confident from lesson/single click" rule extends to any single
// practice session too).
export function applyPracticeEvidence(progress: SkillProgressRow, now: string): ProgressPatch {
  const evidenceCount = progress.evidence_count + 1;
  const patch: ProgressPatch = { evidence_count: evidenceCount, last_practiced_at: now };

  if (progress.status === "confident" || progress.status === "maintenance") {
    return patch; // sustained practice after mastery — evidence/recency only, status/confidence untouched
  }
  if (evidenceCount >= IMPROVING_EVIDENCE_THRESHOLD) {
    patch.status = "improving";
  } else if (evidenceCount >= PRACTICING_EVIDENCE_THRESHOLD && (progress.status === "not_started" || progress.status === "introduced")) {
    patch.status = "practicing";
  }
  return patch;
}

// Blends a skill's own progress signal with its mapped Language Twin
// category confidence, where one exists (plan doc §7). A skill with no
// category mapping (category === null) is scored purely from its own
// progress row — never fabricates a Language Twin signal it doesn't have.
export function blendConfidence(skillConfidence: SkillConfidence, languageTwinConfidence: ConfidenceLevel | null): SkillConfidence {
  if (!languageTwinConfidence) return skillConfidence;
  const rank: Record<SkillConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[languageTwinConfidence] > rank[skillConfidence] ? languageTwinConfidence : skillConfidence;
}

export interface SkillWithProgress {
  skill: Skill;
  progress: SkillProgressRow | null;
}

// Course "content progress" = lesson-completed skills / total skills. Kept
// strictly separate from confidence (plan doc §45's "course progress =
// completed content / total, separate from confidence").
export function courseProgressPercent(path: LearningPath, progressRows: SkillProgressRow[]): number {
  const total = getAllSkills(path).length;
  if (total === 0) return 0;
  const byKey = new Map(progressRows.map((row) => [row.skill_key, row]));
  const completed = getAllSkills(path).filter((skill) => byKey.get(skill.key)?.content_completed_at).length;
  return Math.round((completed / total) * 100);
}

export function countSkillsByStatus(path: LearningPath, progressRows: SkillProgressRow[], statuses: SkillStatus[]): number {
  const byKey = new Map(progressRows.map((row) => [row.skill_key, row]));
  const set = new Set(statuses);
  return getAllSkills(path).filter((skill) => set.has(byKey.get(skill.key)?.status ?? "not_started")).length;
}

// The single "what's next" skill (plan doc §11's Active Path Home /
// recommended-next-action): first skill in curriculum order that hasn't
// reached confident/maintenance yet. Curriculum order never changes based
// on Language Twin signal (plan doc §7's "don't reorder the course").
export function findCurrentFocusSkill(path: LearningPath, progressRows: SkillProgressRow[]): Skill | null {
  const byKey = new Map(progressRows.map((row) => [row.skill_key, row]));
  const mastered: SkillStatus[] = ["confident", "maintenance"];
  return getAllSkills(path).find((skill) => !mastered.includes(byKey.get(skill.key)?.status ?? "not_started")) ?? null;
}

export type StageStatus = "completed" | "current" | "upcoming";

// Stage Page's per-stage status (plan doc's Stage screen): "completed" once
// every skill in it has its lesson content completed, "current" once it
// contains the current focus skill, otherwise "upcoming" — curriculum order
// only, never re-derived from Language Twin signal.
export function stageStatus(stage: Stage, progressRows: SkillProgressRow[], focusSkillKey: string | null): StageStatus {
  const byKey = new Map(progressRows.map((row) => [row.skill_key, row]));
  const skills = stage.modules.flatMap((m) => m.skills);
  const allCompleted = skills.length > 0 && skills.every((skill) => Boolean(byKey.get(skill.key)?.content_completed_at));
  if (allCompleted) return "completed";
  if (focusSkillKey && skills.some((skill) => skill.key === focusSkillKey)) return "current";
  const anyStarted = skills.some((skill) => byKey.has(skill.key));
  return anyStarted ? "current" : "upcoming";
}

export function isPathComplete(path: LearningPath, progressRows: SkillProgressRow[]): boolean {
  const byKey = new Map(progressRows.map((row) => [row.skill_key, row]));
  return getAllSkills(path).every((skill) => Boolean(byKey.get(skill.key)?.content_completed_at));
}
