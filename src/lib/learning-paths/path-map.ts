import type { LearningPath, PathSlug, Skill, SkillConfidence, SkillProgressRow, SkillStatus } from "./types.ts";

// Phase 2, итерация 4 — карта учебного пути: «раздел → модуль → урок», какие
// уроки открыты, какие закрыты, сколько пройдено. Чистые функции: вход —
// статический курс (curriculum/) и строки user_skill_progress, выход — готовая
// модель для экранов. Ни запросов, ни записи.
//
// Правило доступа (одно на весь путь, порядок курса не меняется):
//   done    — урок пройден (content_completed_at): открыт всегда, его можно
//             перечитать;
//   current — первый непройденный урок: открыт, это «следующий шаг»;
//   locked  — любой непройденный урок после него: закрыт, откроется, когда
//             пройден предыдущий.
// «Пройден» — это именно прохождение урока (content_completed_at), как и в
// проценте курса (courseProgressPercent) и в isPathComplete. Уверенность в
// навыке (status/confidence после проверки знаний) — отдельная ось: она
// показывается рядом, но замки не открывает и не закрывает, иначе навыки без
// проверки знаний (category: null) заблокировали бы весь остаток курса.
// Обходной путь для тех, кто уже знает тему, — проверка знаний: результат от
// 80% засчитывает урок сразу (applyKnowledgeCheckResult).

export type NodeState = "done" | "current" | "locked";

export interface LessonNode {
  key: string;
  skill: Skill;
  /** Раздел и модуль, в которых лежит урок (нужны для ссылок между разделами). */
  unitKey: string;
  moduleKey: string;
  /** Номер урока во всём пути, с 1. */
  order: number;
  state: NodeState;
  /** Сохранённый статус навыка; без строки в базе — not_started. */
  status: SkillStatus;
  confidence: SkillConfidence;
  /** У закрытого урока — урок, после прохождения которого он откроется. */
  opensAfter: { key: string; title: string } | null;
}

export interface ModuleNode {
  key: string;
  title: string;
  state: NodeState;
  done: number;
  total: number;
  lessons: LessonNode[];
}

export interface UnitNode {
  key: string;
  title: string;
  description: string;
  /** Номер раздела, с 1. */
  number: number;
  state: NodeState;
  done: number;
  total: number;
  /** Доля пройденных уроков, 0..100. */
  percent: number;
  modules: ModuleNode[];
  /** Все уроки раздела подряд (модули склеены). */
  lessons: LessonNode[];
  /** У закрытого раздела — предыдущий раздел, после которого он откроется. */
  opensAfter: { number: number; title: string } | null;
}

export interface NextLesson {
  unit: UnitNode;
  module: ModuleNode;
  lesson: LessonNode;
}

export interface PathMap {
  slug: PathSlug;
  units: UnitNode[];
  totalLessons: number;
  doneLessons: number;
  /** Та же формула, что у courseProgressPercent. */
  percent: number;
  totalUnits: number;
  doneUnits: number;
  /** Есть хоть какой-то прогресс по урокам этого пути. */
  started: boolean;
  complete: boolean;
  /** Первый непройденный урок; null, когда путь пройден. */
  next: NextLesson | null;
}

export interface LessonContext {
  unit: UnitNode;
  module: ModuleNode;
  lesson: LessonNode;
  /** Позиция урока в разделе (с 1) и число уроков в разделе. */
  positionInUnit: number;
  unitSize: number;
  /** Соседние уроки по порядку курса — в том числе из другого раздела. */
  prev: LessonNode | null;
  next: LessonNode | null;
  /** Первый непройденный урок всего пути (куда вести «дальше»); null — путь пройден. */
  current: LessonNode | null;
}

function nodeState(done: number, total: number, hasCurrent: boolean): NodeState {
  if (total > 0 && done === total) return "done";
  return hasCurrent ? "current" : "locked";
}

function countDone(lessons: LessonNode[]): number {
  return lessons.filter((lesson) => lesson.state === "done").length;
}

function percentOf(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

export function buildPathMap(path: LearningPath, rows: SkillProgressRow[]): PathMap {
  const byKey = new Map(rows.map((row) => [row.skill_key, row]));
  const isDone = (key: string) => Boolean(byKey.get(key)?.content_completed_at);

  const located = path.stages.flatMap((stage) =>
    stage.modules.flatMap((mod) => mod.skills.map((skill) => ({ skill, unitKey: stage.key, moduleKey: mod.key }))),
  );
  const flat = located.map((entry) => entry.skill);
  const currentIndex = flat.findIndex((skill) => !isDone(skill.key));

  const lessonByKey = new Map<string, LessonNode>();
  located.forEach(({ skill, unitKey, moduleKey }, index) => {
    const row = byKey.get(skill.key);
    const state: NodeState = isDone(skill.key) ? "done" : index === currentIndex ? "current" : "locked";
    const previous = index > 0 ? flat[index - 1] : null;
    lessonByKey.set(skill.key, {
      key: skill.key,
      skill,
      unitKey,
      moduleKey,
      order: index + 1,
      state,
      status: row?.status ?? "not_started",
      confidence: row?.confidence ?? "low",
      opensAfter: state === "locked" && previous ? { key: previous.key, title: previous.title } : null,
    });
  });

  const units = path.stages.map((stage, unitIndex): UnitNode => {
    const modules = stage.modules.map((mod): ModuleNode => {
      const lessons = mod.skills.map((skill) => lessonByKey.get(skill.key)!);
      const done = countDone(lessons);
      return {
        key: mod.key,
        title: mod.title,
        state: nodeState(done, lessons.length, lessons.some((lesson) => lesson.state === "current")),
        done,
        total: lessons.length,
        lessons,
      };
    });
    const lessons = modules.flatMap((mod) => mod.lessons);
    const done = countDone(lessons);
    const state = nodeState(done, lessons.length, lessons.some((lesson) => lesson.state === "current"));
    const previous = unitIndex > 0 ? path.stages[unitIndex - 1] : null;
    return {
      key: stage.key,
      title: stage.title,
      description: stage.description,
      number: unitIndex + 1,
      state,
      done,
      total: lessons.length,
      percent: percentOf(done, lessons.length),
      modules,
      lessons,
      opensAfter: state === "locked" && previous ? { number: unitIndex, title: previous.title } : null,
    };
  });

  const doneLessons = flat.filter((skill) => isDone(skill.key)).length;
  const keys = new Set(flat.map((skill) => skill.key));

  let next: NextLesson | null = null;
  for (const unit of units) {
    for (const mod of unit.modules) {
      const lesson = mod.lessons.find((l) => l.state === "current");
      if (lesson) next = { unit, module: mod, lesson };
    }
  }

  return {
    slug: path.slug,
    units,
    totalLessons: flat.length,
    doneLessons,
    percent: percentOf(doneLessons, flat.length),
    totalUnits: units.length,
    doneUnits: units.filter((unit) => unit.state === "done").length,
    started: rows.some((row) => keys.has(row.skill_key) && (row.status !== "not_started" || Boolean(row.content_completed_at))),
    complete: flat.length > 0 && doneLessons === flat.length,
    next,
  };
}

/** Урок в контексте пути: раздел, модуль, позиция и соседи; null — нет такого урока. */
export function lessonContext(map: PathMap, skillKey: string): LessonContext | null {
  const flat = map.units.flatMap((unit) => unit.lessons);
  const index = flat.findIndex((lesson) => lesson.key === skillKey);
  if (index < 0) return null;
  const lesson = flat[index];
  for (const unit of map.units) {
    for (const mod of unit.modules) {
      if (!mod.lessons.some((l) => l.key === skillKey)) continue;
      return {
        unit,
        module: mod,
        lesson,
        positionInUnit: unit.lessons.findIndex((l) => l.key === skillKey) + 1,
        unitSize: unit.lessons.length,
        prev: index > 0 ? flat[index - 1] : null,
        next: index + 1 < flat.length ? flat[index + 1] : null,
        current: map.next?.lesson ?? null,
      };
    }
  }
  return null;
}

/** Открыт ли урок: пройденные и текущий — да, остальные закрыты. */
export function isLessonOpen(map: PathMap, skillKey: string): boolean {
  const context = lessonContext(map, skillKey);
  return context !== null && context.lesson.state !== "locked";
}
