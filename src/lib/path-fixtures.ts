import { getAllPaths, getAllSkills, getPath } from "@/lib/learning-paths/curriculum/index.ts";
import { buildPathMap, lessonContext, type LessonContext, type PathMap } from "@/lib/learning-paths/path-map.ts";
import type { CatalogEntry } from "@/app/(app)/learning-paths/actions";
import type { EnrollmentRow, EnrollmentStatus, LearningPath, SkillProgressRow, SkillStatus } from "@/lib/learning-paths/types.ts";

// Тестовые данные учебного пути для галереи /dev/screens (фикстуры допустимы
// только в /dev/*; в приложении экраны получают сохранённый прогресс). Курс —
// настоящий A2→B1 из curriculum/: названия разделов, модулей и уроков не
// выдуманы, а состояния (пройден / текущий / закрыт) считает тот же
// buildPathMap, что и боевые страницы. Различаются только строки прогресса.
const PATH: LearningPath = getPath("a2-b1")!;
const NOW = "2026-11-14T10:00:00.000Z";

function progressRows(done: number, statuses: Record<number, SkillStatus> = {}): SkillProgressRow[] {
  return getAllSkills(PATH)
    .slice(0, done)
    .map((skill, index) => ({
      id: `fixture-${skill.key}`,
      user_id: "fixture-user",
      path_slug: PATH.slug,
      path_version: PATH.version,
      skill_key: skill.key,
      status: statuses[index] ?? "introduced",
      evidence_count: 0,
      confidence: "low",
      content_completed_at: NOW,
      last_practiced_at: null,
      knowledge_check_best_score: null,
      created_at: NOW,
      updated_at: NOW,
    }));
}

export interface PathFixture {
  path: LearningPath;
  map: PathMap;
  enrollmentStatus: EnrollmentStatus | null;
}

const ALL_LESSONS = getAllSkills(PATH).length;
// Раздел 1 пройден (5 уроков), в разделе 2 пройдены два урока из четырёх.
const MID_ROWS = progressRows(7, { 0: "confident", 1: "confident", 2: "improving", 3: "practicing" });

export const PATH_MID_FIXTURE: PathFixture = { path: PATH, map: buildPathMap(PATH, MID_ROWS), enrollmentStatus: "active" };
export const PATH_NEW_FIXTURE: PathFixture = { path: PATH, map: buildPathMap(PATH, []), enrollmentStatus: "active" };
export const PATH_INTRO_FIXTURE: PathFixture = { path: PATH, map: buildPathMap(PATH, []), enrollmentStatus: null };
export const PATH_PAUSED_FIXTURE: PathFixture = { path: PATH, map: buildPathMap(PATH, MID_ROWS), enrollmentStatus: "paused" };
export const PATH_DONE_FIXTURE: PathFixture = {
  path: PATH,
  map: buildPathMap(PATH, progressRows(ALL_LESSONS, { 0: "confident" })),
  enrollmentStatus: "completed",
};

/** Номер раздела (с 1) → его узел в карте середины пути. */
export function midUnit(number: number) {
  return PATH_MID_FIXTURE.map.units[number - 1];
}

export interface LessonFixture {
  skillKey: string;
  context: LessonContext;
  progress: SkillProgressRow | null;
}

function lessonFixture(skillKey: string): LessonFixture {
  const context = lessonContext(PATH_MID_FIXTURE.map, skillKey);
  if (!context) throw new Error(`Нет урока ${skillKey} в фикстуре пути`);
  return { skillKey, context, progress: MID_ROWS.find((row) => row.skill_key === skillKey) ?? null };
}

const SKILLS = getAllSkills(PATH);
/** Пройденный урок (раздел 1), текущий (раздел 2) и закрытый (раздел 3). */
export const LESSON_DONE_FIXTURE = lessonFixture(SKILLS[2].key);
export const LESSON_CURRENT_FIXTURE = lessonFixture(SKILLS[7].key);
export const LESSON_LOCKED_FIXTURE = lessonFixture(SKILLS[9].key);

function enrollment(slug: EnrollmentRow["path_slug"], status: EnrollmentStatus): EnrollmentRow {
  const path = getPath(slug)!;
  return {
    id: `fixture-enrollment-${slug}`,
    user_id: "fixture-user",
    path_slug: slug,
    path_version: path.version,
    status,
    current_stage_key: path.stages[0].key,
    current_module_key: null,
    started_at: NOW,
    completed_at: status === "completed" ? NOW : null,
    last_activity_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

const CATALOG_STATE: Record<string, { status: EnrollmentStatus; done: number } | undefined> = {
  "a2-b1": { status: "active", done: 7 },
  everyday: { status: "paused", done: 3 },
  "it-english": { status: "completed", done: 12 },
};

/** Каталог нового пользователя: путей ещё нет, есть рекомендация. */
export const CATALOG_NEW_FIXTURE: CatalogEntry[] = getAllPaths().map((path) => ({
  path,
  enrollment: null,
  progress: { done: 0, total: getAllSkills(path).length },
}));

/** Каталог путей: активный с прогрессом, на паузе, пройденный и не начатый. */
export const CATALOG_FIXTURE: CatalogEntry[] = getAllPaths().map((path) => {
  const state = CATALOG_STATE[path.slug];
  return {
    path,
    enrollment: state ? enrollment(path.slug, state.status) : null,
    progress: { done: state?.done ?? 0, total: getAllSkills(path).length },
  };
});
