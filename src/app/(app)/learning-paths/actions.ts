"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllPaths, getPath, isValidSkillForPath, findStageForSkill, findSkill } from "@/lib/learning-paths/curriculum/index.ts";
import {
  applyKnowledgeCheckResult,
  applyLessonCompletion,
  applyPracticeEvidence,
  courseProgressPercent,
  countSkillsByStatus,
  findCurrentFocusSkill,
  isPathComplete,
  scoreKnowledgeCheck,
  stageStatus,
  type KnowledgeCheckOutcome,
} from "@/lib/learning-paths/progress-engine.ts";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  getActiveEnrollment,
  getEnrollments,
  getOrCreateSkillProgress,
  getSkillProgressForPath,
  markPathCompleted,
  pausePath,
  setCurrentStage,
  startOrResumePath,
  applySkillProgressPatch,
} from "@/lib/learning-paths/persist.ts";
import { getSkillLanguageTwinSignal, type SkillLanguageTwinSignal } from "@/lib/learning-paths/language-twin-mapping.ts";
import { findMatchingMissionForSkill } from "@/lib/learning-paths/mission-match.ts";
import { recommendPath, type PathRecommendation } from "@/lib/learning-paths/recommendation.ts";
import { getOrGenerateActiveMissions } from "@/lib/missions/persist";
import type { EnrollmentRow, LearningPath, PathSlug, Skill, SkillProgressRow, Stage } from "@/lib/learning-paths/types.ts";

const PATH = "/learning-paths";

function revalidateLearningPaths() {
  revalidatePath(PATH);
  revalidatePath("/home");
  revalidatePath("/progress");
  revalidatePath("/library");
}

export interface CatalogEntry {
  path: LearningPath;
  enrollment: EnrollmentRow | null;
}

export interface CatalogState {
  entries: CatalogEntry[];
  recommendation: PathRecommendation | null;
}

export async function getCatalogAction(): Promise<CatalogState> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [enrollments, twinProfile] = await Promise.all([
    getEnrollments(supabase, profile.id),
    supabase.from("language_twin_profiles").select("behavioral_level_range").eq("user_id", profile.id).maybeSingle(),
  ]);
  const byPathSlug = new Map(enrollments.map((e) => [e.path_slug, e]));
  const entries = getAllPaths().map((path) => ({ path, enrollment: byPathSlug.get(path.slug) ?? null }));

  // No recommendation banner once the user already has an active path —
  // it's already decided, showing one would just be noise (plan doc's
  // "never auto-enroll" extends to "never re-pitch an active choice").
  const hasActive = enrollments.some((e) => e.status === "active");
  const recommendation = hasActive ? null : recommendPath(twinProfile.data?.behavioral_level_range ?? null);

  return { entries, recommendation };
}

export interface PathDetailsState extends CatalogEntry {
  otherActivePath: LearningPath | null;
}

export async function getPathDetailsAction(pathSlug: PathSlug): Promise<PathDetailsState | null> {
  const path = getPath(pathSlug);
  if (!path) return null;
  const profile = await requireProfile();
  const supabase = await createClient();
  const enrollments = await getEnrollments(supabase, profile.id);
  const enrollment = enrollments.find((e) => e.path_slug === pathSlug) ?? null;
  const otherActive = enrollments.find((e) => e.status === "active" && e.path_slug !== pathSlug) ?? null;
  return { path, enrollment, otherActivePath: otherActive ? getPath(otherActive.path_slug) : null };
}

export async function startPathAction(pathSlug: PathSlug): Promise<EnrollmentRow | null> {
  if (!getPath(pathSlug)) return null;
  const profile = await requireProfile();
  const supabase = await createClient();
  const enrollment = await startOrResumePath(supabase, profile.id, pathSlug);
  revalidateLearningPaths();
  return enrollment;
}

export async function pausePathAction(pathSlug: PathSlug): Promise<void> {
  if (!getPath(pathSlug)) return;
  const profile = await requireProfile();
  const supabase = await createClient();
  await pausePath(supabase, profile.id, pathSlug);
  revalidateLearningPaths();
}

export interface ActivePathState {
  enrollment: EnrollmentRow;
  path: LearningPath;
  progressRows: SkillProgressRow[];
  contentProgressPercent: number;
  skillsConfident: number;
  skillsImproving: number;
  currentStage: Stage | null;
  focusSkill: Skill | null;
}

export async function getActivePathStateAction(): Promise<ActivePathState | null> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const enrollment = await getActiveEnrollment(supabase, profile.id);
  if (!enrollment) return null;
  const path = getPath(enrollment.path_slug);
  if (!path) return null;

  const progressRows = await getSkillProgressForPath(supabase, profile.id, path.slug, path.version);
  const focusSkill = findCurrentFocusSkill(path, progressRows);

  return {
    enrollment,
    path,
    progressRows,
    contentProgressPercent: courseProgressPercent(path, progressRows),
    skillsConfident: countSkillsByStatus(path, progressRows, ["confident", "maintenance"]),
    skillsImproving: countSkillsByStatus(path, progressRows, ["improving"]),
    currentStage: path.stages.find((s) => s.key === enrollment.current_stage_key) ?? path.stages[0] ?? null,
    focusSkill,
  };
}

export interface StageState {
  path: LearningPath;
  stage: Stage;
  enrollment: EnrollmentRow | null;
  progressRows: SkillProgressRow[];
}

export async function getStageStateAction(pathSlug: PathSlug, stageKey: string): Promise<StageState | null> {
  const path = getPath(pathSlug);
  const stage = path?.stages.find((s) => s.key === stageKey) ?? null;
  if (!path || !stage) return null;
  const profile = await requireProfile();
  const supabase = await createClient();
  const [enrollment, progressRows] = await Promise.all([
    getActiveEnrollment(supabase, profile.id),
    getSkillProgressForPath(supabase, profile.id, path.slug, path.version),
  ]);
  return { path, stage, enrollment: enrollment?.path_slug === pathSlug ? enrollment : null, progressRows };
}

export interface SkillState {
  path: LearningPath;
  stage: Stage;
  skill: Skill;
  progress: SkillProgressRow | null;
  languageTwinSignal: SkillLanguageTwinSignal | null;
  matchingMissionId: string | null;
}

export async function getSkillStateAction(pathSlug: PathSlug, skillKey: string): Promise<SkillState | null> {
  const path = getPath(pathSlug);
  if (!path || !isValidSkillForPath(pathSlug, skillKey)) return null;
  const skill = findSkill(path, skillKey);
  const stage = findStageForSkill(path, skillKey);
  if (!skill || !stage) return null;

  const profile = await requireProfile();
  const supabase = await createClient();
  const [progress, languageTwinSignal, missions] = await Promise.all([
    getOrCreateSkillProgress(supabase, profile.id, path.slug, path.version, skillKey),
    getSkillLanguageTwinSignal(supabase, profile.id, skill.category),
    getOrGenerateActiveMissions(supabase, profile.id),
  ]);
  const matchingMission = findMatchingMissionForSkill(missions, skill);
  return { path, stage, skill, progress, languageTwinSignal, matchingMissionId: matchingMission?.id ?? null };
}

// Advances the enrollment's current_stage_key/current_module_key to track
// wherever the user is actually working — used after a lesson/knowledge
// check completion, never a separate user-facing action (plan doc's active
// CTA rule: this is bookkeeping, not something a button claims to do).
async function advanceCurrentPosition(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, path: LearningPath, skillKey: string) {
  const stage = findStageForSkill(path, skillKey);
  if (!stage) return;
  const mod = stage.modules.find((m) => m.skills.some((s) => s.key === skillKey));
  await setCurrentStage(supabase, userId, path.slug, stage.key, mod?.key ?? null);
}

async function maybeCompletePathAndAdvance(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, path: LearningPath, skillKey: string) {
  await advanceCurrentPosition(supabase, userId, path, skillKey);
  const rows = await getSkillProgressForPath(supabase, userId, path.slug, path.version);

  // stage_completed only fires on the transition into "completed" (not on
  // every subsequent visit) — the containing stage was just re-checked, so
  // comparing this skill against the OTHER skills already in `rows` is
  // enough to know whether it just tipped the stage over.
  const stage = findStageForSkill(path, skillKey);
  if (stage && stageStatus(stage, rows, null) === "completed") {
    captureServerEvent(userId, "stage_completed", { path_slug: path.slug, stage_key: stage.key });
  }

  if (isPathComplete(path, rows)) {
    await markPathCompleted(supabase, userId, path.slug);
    captureServerEvent(userId, "learning_path_completed", { path_slug: path.slug });
  }
}

export async function completeLessonAction(pathSlug: PathSlug, skillKey: string): Promise<SkillProgressRow | null> {
  if (!isValidSkillForPath(pathSlug, skillKey)) return null;
  const path = getPath(pathSlug);
  if (!path) return null;
  const profile = await requireProfile();
  const supabase = await createClient();

  const progress = await getOrCreateSkillProgress(supabase, profile.id, path.slug, path.version, skillKey);
  const patch = applyLessonCompletion(progress, new Date().toISOString());
  const updated = await applySkillProgressPatch(supabase, profile.id, progress.id, patch);
  await maybeCompletePathAndAdvance(supabase, profile.id, path, skillKey);

  revalidateLearningPaths();
  return updated ?? progress;
}

export interface KnowledgeCheckSubmitResult {
  outcome: KnowledgeCheckOutcome;
  progress: SkillProgressRow;
  /** M3 Slice 9 (plan doc §16/§17) — true exactly once, the first time any
   *  Knowledge Check completes for an account that hadn't won yet. Not
   *  onboarding-specific plumbing: any real completed Knowledge Check
   *  counts, matching "no fake onboarding-only exercise". */
  firstWinJustCompleted: boolean;
}

// Server-side scoring (never trust a client-computed score/bucket): the
// caller sends raw correct/total counts from the deterministic Grammar
// Runner question set, this function is the only place the strong/mixed/
// weak bucket and the resulting status transition are decided.
export async function submitKnowledgeCheckAction(pathSlug: PathSlug, skillKey: string, correct: number, total: number): Promise<KnowledgeCheckSubmitResult | null> {
  if (!isValidSkillForPath(pathSlug, skillKey)) return null;
  const path = getPath(pathSlug);
  if (!path) return null;
  const profile = await requireProfile();
  const supabase = await createClient();

  const progress = await getOrCreateSkillProgress(supabase, profile.id, path.slug, path.version, skillKey);
  const outcome = scoreKnowledgeCheck(correct, total);
  const patch = applyKnowledgeCheckResult(progress, outcome, new Date().toISOString());
  const updated = await applySkillProgressPatch(supabase, profile.id, progress.id, patch);
  await maybeCompletePathAndAdvance(supabase, profile.id, path, skillKey);

  let firstWinJustCompleted = false;
  if (!profile.completed_first_win) {
    await supabase.from("profiles").update({ completed_first_win: true }).eq("id", profile.id);
    firstWinJustCompleted = true;
    captureServerEvent(profile.id, "onboarding_first_win_completed", { path_slug: pathSlug, skill_key: skillKey });
    captureServerEvent(profile.id, "onboarding_completed", { path_slug: pathSlug });
  }

  revalidateLearningPaths();
  revalidatePath("/language-twin");
  return { outcome, progress: updated ?? progress, firstWinJustCompleted };
}

// Called after a real Mission/Practice session that touched this skill's
// mapped category completes (Phase C wiring) — never a standalone
// user-facing button, always a side effect of a real completed session.
export async function recordSkillPracticeEvidenceAction(pathSlug: PathSlug, skillKey: string): Promise<SkillProgressRow | null> {
  if (!isValidSkillForPath(pathSlug, skillKey)) return null;
  const path = getPath(pathSlug);
  if (!path) return null;
  const profile = await requireProfile();
  const supabase = await createClient();

  const progress = await getOrCreateSkillProgress(supabase, profile.id, path.slug, path.version, skillKey);
  const patch = applyPracticeEvidence(progress, new Date().toISOString());
  const updated = await applySkillProgressPatch(supabase, profile.id, progress.id, patch);
  revalidateLearningPaths();
  return updated ?? progress;
}
