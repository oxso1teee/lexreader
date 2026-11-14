"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getAllPaths, getAllSkills, getPath, isValidSkillForPath, findStageForSkill, findSkill } from "@/lib/learning-paths/curriculum/index.ts";
import {
  applyKnowledgeCheckResult,
  applyLessonCompletion,
  applyPracticeEvidence,
  courseProgressPercent,
  countSkillsByStatus,
  findCurrentFocusSkill,
  scoreKnowledgeCheck,
  type KnowledgeCheckOutcome,
} from "@/lib/learning-paths/progress-engine.ts";
import { buildPathMap, isLessonOpen, lessonContext, type LessonContext, type PathMap, type UnitNode } from "@/lib/learning-paths/path-map.ts";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  getActiveEnrollment,
  getCompletedLessonRefs,
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

// Вызывается после каждого изменения прогресса по уроку: переносит сохранённую
// позицию зачисления (current_stage_key/current_module_key) на следующий урок,
// отдаёт «раздел пройден» и закрывает путь, когда пройден последний урок —
// отдельным действием пользователя это не бывает (plan doc's active CTA rule:
// это учёт, а не то, что обещает кнопка). `newlyCompleted` — этим вызовом урок
// впервые засчитан: события и экран «раздел пройден» повторно не отправляются
// при пересдаче проверки или повторном нажатии.
async function afterProgressChange(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  path: LearningPath,
  skillKey: string,
  newlyCompleted: boolean,
): Promise<UnitDoneMoment | null> {
  const rows = await getSkillProgressForPath(supabase, userId, path.slug, path.version);
  const map = buildPathMap(path, rows);

  const lastUnit = map.units[map.units.length - 1];
  await setCurrentStage(supabase, userId, path.slug, map.next ? map.next.unit.key : lastUnit.key, map.next ? map.next.module.key : null);

  if (!newlyCompleted) return null;

  let unitDone: UnitDoneMoment | null = null;
  const unit = map.units.find((u) => u.lessons.some((lesson) => lesson.key === skillKey));
  if (unit?.state === "done") {
    captureServerEvent(userId, "stage_completed", { path_slug: path.slug, stage_key: unit.key });
    // docs/moments/ROADMAP.md, этап 4 — Unit-done. Номер раздела и следующий
    // раздел — из реального порядка курса (curriculum, не из БД), тот же
    // массив, что рисует карта пути.
    const nextUnit = map.units[unit.number] ?? null;
    unitDone = {
      kind: "unit_done",
      id: `unit-done-${userId}-${path.slug}-${unit.key}`,
      pathTitle: path.title,
      stageTitle: unit.title,
      stageIndex: unit.number,
      stagesTotal: map.totalUnits,
      skillsInStage: unit.total,
      nextStageTitle: nextUnit?.title ?? null,
    };
  }

  if (map.complete) {
    await markPathCompleted(supabase, userId, path.slug);
    captureServerEvent(userId, "learning_path_completed", { path_slug: path.slug });
  }

  return unitDone;
}

export interface CompleteLessonResult {
  progress: SkillProgressRow | null;
  unitDoneMoment: UnitDoneMoment | null;
}

export async function completeLessonAction(pathSlug: PathSlug, skillKey: string): Promise<CompleteLessonResult | null> {
  if (!isValidSkillForPath(pathSlug, skillKey)) return null;
  const path = getPath(pathSlug);
  if (!path) return null;
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
  // Проверка знаний работает и на закрытом уроке: результат от 80% засчитывает
  // урок сразу (так можно пропустить тему, которую уже знаешь) — поэтому замок
  // здесь намеренно не проверяется.
  const newlyCompleted = !progress.content_completed_at && Boolean(patch.content_completed_at);
  await afterProgressChange(supabase, profile.id, path, skillKey, newlyCompleted);

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
