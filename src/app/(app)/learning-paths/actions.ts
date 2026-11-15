"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllPaths, getAllSkills, getPath, isValidSkillForPath, findStageForSkill, findSkill } from "@/lib/learning-paths/curriculum/index.ts";
import { afterProgressChange } from "@/lib/learning-paths/after-progress.ts";
import { lessonRequiresExercises } from "@/lib/lessons/plan";
import {
  applyLessonCompletion,
  applyPracticeEvidence,
  courseProgressPercent,
  countSkillsByStatus,
  findCurrentFocusSkill,
} from "@/lib/learning-paths/progress-engine.ts";
import { buildPathMap, isLessonOpen, lessonContext, type LessonContext, type PathMap, type UnitNode } from "@/lib/learning-paths/path-map.ts";
import {
  getActiveEnrollment,
  getCompletedLessonRefs,
  getEnrollments,
  getOrCreateSkillProgress,
  getSkillProgressForPath,
  pausePath,
  startOrResumePath,
  applySkillProgressPatch,
} from "@/lib/learning-paths/persist.ts";
import { getSkillLanguageTwinSignal, type SkillLanguageTwinSignal } from "@/lib/learning-paths/language-twin-mapping.ts";
import { findMatchingMissionForSkill } from "@/lib/learning-paths/mission-match.ts";
import { recommendPath, type PathRecommendation } from "@/lib/learning-paths/recommendation.ts";
import { getOrGenerateActiveMissions } from "@/lib/missions/persist";
import type { EnrollmentRow, LearningPath, PathSlug, Skill, SkillProgressRow, Stage } from "@/lib/learning-paths/types.ts";
import type { UnitDoneMoment } from "@/lib/moments/types";

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
  /** Пройдено уроков из всех — у каждого пути, активен он или нет. */
  progress: { done: number; total: number };
}

export interface CatalogState {
  entries: CatalogEntry[];
  recommendation: PathRecommendation | null;
}

export async function getCatalogAction(): Promise<CatalogState> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [enrollments, twinProfile, completed] = await Promise.all([
    getEnrollments(supabase, profile.id),
    supabase.from("language_twin_profiles").select("behavioral_level_range").eq("user_id", profile.id).maybeSingle(),
    getCompletedLessonRefs(supabase, profile.id),
  ]);
  const byPathSlug = new Map(enrollments.map((e) => [e.path_slug, e]));
  const entries = getAllPaths().map((path) => {
    const lessonKeys = new Set(getAllSkills(path).map((skill) => skill.key));
    const done = completed.filter(
      (ref) => ref.path_slug === path.slug && ref.path_version === path.version && lessonKeys.has(ref.skill_key),
    ).length;
    return { path, enrollment: byPathSlug.get(path.slug) ?? null, progress: { done, total: lessonKeys.size } };
  });

  // No recommendation banner once the user already has an active path —
  // it's already decided, showing one would just be noise (plan doc's
  // "never auto-enroll" extends to "never re-pitch an active choice").
  const hasActive = enrollments.some((e) => e.status === "active");
  const recommendation = hasActive ? null : recommendPath(twinProfile.data?.behavioral_level_range ?? null);

  return { entries, recommendation };
}

export interface PathMapState {
  path: LearningPath;
  enrollment: EnrollmentRow | null;
  otherActivePath: LearningPath | null;
  /** Разделы, модули и уроки пути с состояниями «пройден / текущий / закрыт». */
  map: PathMap;
}

// Карта пути: зачисление + сохранённый прогресс по урокам (две выборки с
// owner-RLS, параллельно). Прогресс есть и у пути без зачисления (например,
// пройденного раньше), поэтому карта строится всегда.
export async function getPathMapAction(pathSlug: PathSlug): Promise<PathMapState | null> {
  const path = getPath(pathSlug);
  if (!path) return null;
  const profile = await requireProfile();
  const supabase = await createClient();
  const [enrollments, rows] = await Promise.all([
    getEnrollments(supabase, profile.id),
    getSkillProgressForPath(supabase, profile.id, path.slug, path.version),
  ]);
  const enrollment = enrollments.find((e) => e.path_slug === pathSlug) ?? null;
  const otherActive = enrollments.find((e) => e.status === "active" && e.path_slug !== pathSlug) ?? null;
  return {
    path,
    enrollment,
    otherActivePath: otherActive ? getPath(otherActive.path_slug) : null,
    map: buildPathMap(path, rows),
  };
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
  /** Зачисление именно в этот путь (активное, на паузе, пройдено) или null. */
  enrollment: EnrollmentRow | null;
  map: PathMap;
  unit: UnitNode;
}

export async function getStageStateAction(pathSlug: PathSlug, stageKey: string): Promise<StageState | null> {
  const path = getPath(pathSlug);
  const stage = path?.stages.find((s) => s.key === stageKey) ?? null;
  if (!path || !stage) return null;
  const profile = await requireProfile();
  const supabase = await createClient();
  const [enrollments, progressRows] = await Promise.all([
    getEnrollments(supabase, profile.id),
    getSkillProgressForPath(supabase, profile.id, path.slug, path.version),
  ]);
  const map = buildPathMap(path, progressRows);
  const unit = map.units.find((u) => u.key === stage.key);
  if (!unit) return null;
  return { path, stage, enrollment: enrollments.find((e) => e.path_slug === path.slug) ?? null, map, unit };
}

export interface SkillState {
  path: LearningPath;
  stage: Stage;
  skill: Skill;
  progress: SkillProgressRow | null;
  /** Раздел, модуль, позиция в разделе, соседние уроки и состояние урока. */
  context: LessonContext;
  languageTwinSignal: SkillLanguageTwinSignal | null;
  matchingMissionId: string | null;
}

// Страница урока читает прогресс, а не создаёт его: строка user_skill_progress
// появляется при первом действии (урок пройден, проверка, практика), а не от
// самого просмотра — иначе одно открытие закрытого урока «начинало» бы его.
export async function getSkillStateAction(pathSlug: PathSlug, skillKey: string): Promise<SkillState | null> {
  const path = getPath(pathSlug);
  if (!path || !isValidSkillForPath(pathSlug, skillKey)) return null;
  const skill = findSkill(path, skillKey);
  const stage = findStageForSkill(path, skillKey);
  if (!skill || !stage) return null;

  const profile = await requireProfile();
  const supabase = await createClient();
  const rows = await getSkillProgressForPath(supabase, profile.id, path.slug, path.version);
  const context = lessonContext(buildPathMap(path, rows), skillKey);
  if (!context) return null;
  const progress = rows.find((row) => row.skill_key === skillKey) ?? null;

  // Закрытый урок не показывает содержимого, обогащать нечем — и незачем
  // генерировать миссии ради страницы, которой пользоваться нельзя.
  if (context.lesson.state === "locked") {
    return { path, stage, skill, progress, context, languageTwinSignal: null, matchingMissionId: null };
  }

  const [languageTwinSignal, missions] = await Promise.all([
    getSkillLanguageTwinSignal(supabase, profile.id, skill.category),
    getOrGenerateActiveMissions(supabase, profile.id, profile.target_language),
  ]);
  const matchingMission = findMatchingMissionForSkill(missions, skill);
  return { path, stage, skill, progress, context, languageTwinSignal, matchingMissionId: matchingMission?.id ?? null };
}

export interface CompleteLessonResult {
  progress: SkillProgressRow | null;
  unitDoneMoment: UnitDoneMoment | null;
}

export async function completeLessonAction(pathSlug: PathSlug, skillKey: string): Promise<CompleteLessonResult | null> {
  if (!isValidSkillForPath(pathSlug, skillKey)) return null;
  const path = getPath(pathSlug);
  if (!path) return null;
  // Урок с упражнениями засчитывается только через плеер или проверку знаний,
  // где ответы проверяет сервер. Ручное «изучено» остаётся для уроков, где
  // проверять нечего (чтение): иначе одним запросом можно было бы пропустить
  // все упражнения и открыть следующий урок.
  const skill = findSkill(path, skillKey);
  if (!skill || lessonRequiresExercises(skill)) return null;
  const profile = await requireProfile();
  const supabase = await createClient();

  // Замок проверяется и на сервере, а не только в интерфейсе: закрытый урок
  // нельзя засчитать самодельным запросом.
  const rows = await getSkillProgressForPath(supabase, profile.id, path.slug, path.version);
  if (!isLessonOpen(buildPathMap(path, rows), skillKey)) return null;

  // Уже пройденный урок — ничего не меняем и не празднуем второй раз.
  const existing = rows.find((row) => row.skill_key === skillKey) ?? null;
  if (existing?.content_completed_at) return { progress: existing, unitDoneMoment: null };

  const progress = existing ?? (await getOrCreateSkillProgress(supabase, profile.id, path.slug, path.version, skillKey));
  const patch = applyLessonCompletion(progress, new Date().toISOString());
  const updated = await applySkillProgressPatch(supabase, profile.id, progress.id, patch);
  const unitDoneMoment = await afterProgressChange(supabase, profile.id, path, skillKey, true);

  revalidateLearningPaths();
  return { progress: updated ?? progress, unitDoneMoment };
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
