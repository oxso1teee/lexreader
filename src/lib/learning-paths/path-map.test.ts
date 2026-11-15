import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPathMap, isLessonOpen, lessonContext } from "./path-map.ts";
import { courseProgressPercent, findCurrentFocusSkill, isPathComplete, stageStatus } from "./progress-engine.ts";
import { getAllPaths, getAllSkills, getPath } from "./curriculum/index.ts";
import type { LearningPath, SkillProgressRow } from "./types.ts";

const NOW = "2026-11-14T10:00:00.000Z";
const path = getPath("a2-b1")!;
const skills = getAllSkills(path);

function row(skillKey: string, overrides: Partial<SkillProgressRow> = {}): SkillProgressRow {
  return {
    id: `row-${skillKey}`,
    user_id: "user-1",
    path_slug: "a2-b1",
    path_version: 1,
    skill_key: skillKey,
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

function lessonDone(skillKey: string): SkillProgressRow {
  return row(skillKey, { status: "introduced", content_completed_at: NOW });
}

function firstDone(p: LearningPath, count: number): SkillProgressRow[] {
  return getAllSkills(p)
    .slice(0, count)
    .map((s) => lessonDone(s.key));
}

test("buildPathMap: a fresh path opens only the first lesson, everything after it is locked", () => {
  const map = buildPathMap(path, []);
  const lessons = map.units.flatMap((u) => u.lessons);
  assert.equal(lessons[0].state, "current");
  assert.ok(lessons.slice(1).every((l) => l.state === "locked"));
  assert.equal(map.next?.lesson.key, skills[0].key);
  assert.equal(map.next?.unit.number, 1);
  assert.equal(map.percent, 0);
  assert.equal(map.doneLessons, 0);
  assert.equal(map.doneUnits, 0);
  assert.equal(map.started, false);
  assert.equal(map.complete, false);
  assert.deepEqual(
    map.units.map((u) => u.state),
    ["current", ...map.units.slice(1).map(() => "locked")],
  );
});

test("buildPathMap: a locked lesson names the lesson before it; open lessons name nothing", () => {
  const map = buildPathMap(path, firstDone(path, 1));
  const lessons = map.units.flatMap((u) => u.lessons);
  assert.equal(lessons[0].opensAfter, null); // done
  assert.equal(lessons[1].state, "current");
  assert.equal(lessons[1].opensAfter, null);
  assert.deepEqual(lessons[2].opensAfter, { key: skills[1].key, title: skills[1].title });
  assert.deepEqual(lessons[3].opensAfter, { key: skills[2].key, title: skills[2].title });
});

test("buildPathMap: finishing lessons in order always opens exactly the next one — for every real path", () => {
  for (const p of getAllPaths()) {
    const all = getAllSkills(p);
    for (let finished = 0; finished <= all.length; finished++) {
      const map = buildPathMap(p, firstDone(p, finished));
      const states = map.units.flatMap((u) => u.lessons).map((l) => l.state);
      const expected = all.map((_, i) => (i < finished ? "done" : i === finished ? "current" : "locked"));
      assert.deepEqual(states, expected, `${p.slug} after ${finished} lessons`);
      assert.equal(map.doneLessons, finished);
    }
  }
});

test("buildPathMap: a unit is done when all its lessons are, the next unit becomes current, later ones stay locked", () => {
  const firstUnitSize = path.stages[0].modules.flatMap((m) => m.skills).length;
  const map = buildPathMap(path, firstDone(path, firstUnitSize));
  assert.equal(map.units[0].state, "done");
  assert.equal(map.units[0].percent, 100);
  assert.equal(map.units[1].state, "current");
  assert.equal(map.units[1].opensAfter, null);
  assert.equal(map.units[2].state, "locked");
  assert.deepEqual(map.units[2].opensAfter, { number: 2, title: path.stages[1].title });
  assert.equal(map.doneUnits, 1);
  assert.equal(map.next?.unit.key, path.stages[1].key);
});

test("buildPathMap: module state follows its lessons inside a unit", () => {
  const modules = path.stages[0].modules;
  const firstModuleSize = modules[0].skills.length;
  const map = buildPathMap(path, firstDone(path, firstModuleSize));
  const unit = map.units[0];
  assert.equal(unit.state, "current");
  assert.equal(unit.modules[0].state, "done");
  assert.equal(unit.modules[0].done, firstModuleSize);
  assert.equal(unit.modules[1].state, "current");
  assert.equal(unit.modules[1].done, 0);
  assert.equal(map.next?.module.key, modules[1].key);

  const midway = buildPathMap(path, firstDone(path, 1));
  assert.equal(midway.units[0].modules[0].state, "current");
  assert.equal(midway.units[0].modules[0].done, 1);
  assert.equal(midway.units[0].modules[1].state, "locked");
});

test("buildPathMap: progress saved out of order keeps finished lessons open and the first gap current", () => {
  // legacy data: lessons were open in any order before the lock existed
  const rows = [lessonDone(skills[0].key), lessonDone(skills[2].key)];
  const lessons = buildPathMap(path, rows).units.flatMap((u) => u.lessons);
  assert.equal(lessons[0].state, "done");
  assert.equal(lessons[1].state, "current");
  assert.equal(lessons[2].state, "done"); // finished lesson stays reachable
  assert.equal(lessons[3].state, "locked");
  assert.equal(buildPathMap(path, rows).doneLessons, 2);
  assert.equal(buildPathMap(path, rows).next?.lesson.key, skills[1].key);
});

test("buildPathMap: a finished path has no next lesson and every unit is done", () => {
  const map = buildPathMap(path, firstDone(path, skills.length));
  assert.equal(map.complete, true);
  assert.equal(map.next, null);
  assert.equal(map.percent, 100);
  assert.equal(map.doneUnits, map.totalUnits);
  assert.ok(map.units.every((u) => u.state === "done" && u.opensAfter === null));
  assert.ok(map.units.flatMap((u) => u.modules).every((m) => m.state === "done"));
});

test("buildPathMap: mastery never opens or closes a lock — only a finished lesson does", () => {
  // confident without a finished lesson (legacy/odd row): still the current lesson
  const masteredOnly = [row(skills[0].key, { status: "confident", confidence: "high" })];
  assert.equal(buildPathMap(path, masteredOnly).next?.lesson.key, skills[0].key);
  // finished lesson with no passed check: done, and the next one is open
  const lessonOnly = [lessonDone(skills[0].key)];
  const lessons = buildPathMap(path, lessonOnly).units.flatMap((u) => u.lessons);
  assert.equal(lessons[0].state, "done");
  assert.equal(lessons[1].state, "current");
  // practice evidence on a lesson that has not been read does not skip it either
  const practiced = [row(skills[0].key, { status: "improving", evidence_count: 3 })];
  assert.equal(buildPathMap(path, practiced).next?.lesson.key, skills[0].key);
});

test("buildPathMap: lesson nodes carry the saved status and confidence, defaults without a row", () => {
  const rows = [row(skills[0].key, { status: "confident", confidence: "high", content_completed_at: NOW })];
  const lessons = buildPathMap(path, rows).units.flatMap((u) => u.lessons);
  assert.equal(lessons[0].status, "confident");
  assert.equal(lessons[0].confidence, "high");
  assert.equal(lessons[1].status, "not_started");
  assert.equal(lessons[1].confidence, "low");
});

test("buildPathMap: started reflects real progress on this path only", () => {
  assert.equal(buildPathMap(path, []).started, false);
  assert.equal(buildPathMap(path, [row(skills[0].key)]).started, false); // an empty row is not progress
  assert.equal(buildPathMap(path, [row(skills[0].key, { status: "introduced" })]).started, true); // e.g. a weak check
  assert.equal(buildPathMap(path, [lessonDone(skills[0].key)]).started, true);
  assert.equal(buildPathMap(path, [lessonDone("grammar.does_not_exist")]).started, false);
});

test("buildPathMap: rows for skills that are not in the path are ignored", () => {
  const map = buildPathMap(path, [lessonDone("grammar.does_not_exist"), ...firstDone(path, 2)]);
  assert.equal(map.doneLessons, 2);
  assert.equal(map.percent, courseProgressPercent(path, firstDone(path, 2)));
});

test("buildPathMap: numbering and totals are consistent for every real path", () => {
  for (const p of getAllPaths()) {
    const map = buildPathMap(p, []);
    const lessons = map.units.flatMap((u) => u.lessons);
    assert.equal(new Set(lessons.map((l) => l.key)).size, lessons.length, `${p.slug}: lesson keys are unique`);
    assert.deepEqual(
      lessons.map((l) => l.order),
      lessons.map((_, i) => i + 1),
    );
    assert.deepEqual(
      map.units.map((u) => u.number),
      map.units.map((_, i) => i + 1),
    );
    assert.equal(map.totalLessons, lessons.length);
    assert.equal(map.totalLessons, getAllSkills(p).length);
    assert.equal(map.totalUnits, p.stages.length);
    for (const unit of map.units) {
      assert.equal(unit.total, unit.modules.reduce((sum, m) => sum + m.total, 0));
      assert.equal(unit.lessons.length, unit.total);
      assert.ok(unit.total > 0, `${p.slug}/${unit.key} has lessons`);
    }
  }
});

test("buildPathMap agrees with progress-engine on percent, completion, next skill and unit status", () => {
  for (const p of getAllPaths()) {
    const all = getAllSkills(p);
    for (let finished = 0; finished <= all.length; finished++) {
      const rows = firstDone(p, finished);
      const map = buildPathMap(p, rows);
      const label = `${p.slug} after ${finished}`;
      assert.equal(map.percent, courseProgressPercent(p, rows), label);
      assert.equal(map.complete, isPathComplete(p, rows), label);
      assert.equal(map.next?.lesson.key ?? null, findCurrentFocusSkill(p, rows)?.key ?? null, label);
      p.stages.forEach((stage, i) => {
        assert.equal(
          map.units[i].state === "done",
          stageStatus(stage, rows, null) === "completed",
          `${label}: unit ${stage.key}`,
        );
      });
    }
  }
});

test("lessonContext: position in the unit, unit/module, and neighbours across unit borders", () => {
  const map = buildPathMap(path, []);
  const unit0 = map.units[0];
  const first = lessonContext(map, unit0.lessons[0].key)!;
  assert.equal(first.prev, null);
  assert.equal(first.next?.key, unit0.lessons[1].key);
  assert.equal(first.positionInUnit, 1);
  assert.equal(first.unitSize, unit0.lessons.length);
  assert.equal(first.unit.key, unit0.key);
  assert.equal(first.module.key, unit0.modules[0].key);

  const lastOfUnit0 = lessonContext(map, unit0.lessons[unit0.lessons.length - 1].key)!;
  assert.equal(lastOfUnit0.positionInUnit, unit0.lessons.length);
  assert.equal(lastOfUnit0.next?.key, map.units[1].lessons[0].key); // next unit's first lesson
  assert.equal(lastOfUnit0.next?.state, "locked");

  const lastUnit = map.units[map.units.length - 1];
  const veryLast = lessonContext(map, lastUnit.lessons[lastUnit.lessons.length - 1].key)!;
  assert.equal(veryLast.next, null);
  assert.equal(veryLast.prev?.key, lastUnit.lessons[lastUnit.lessons.length - 2].key);

  // a lesson from the second module reports that module
  const secondModuleLesson = unit0.modules[1].lessons[0];
  assert.equal(lessonContext(map, secondModuleLesson.key)?.module.key, unit0.modules[1].key);
});

test("lessonContext: `current` is the path's first unfinished lesson, whatever lesson is being viewed; null once the path is done", () => {
  const map = buildPathMap(path, firstDone(path, 2));
  assert.equal(lessonContext(map, skills[0].key)?.current?.key, skills[2].key); // viewing a finished lesson
  assert.equal(lessonContext(map, skills[2].key)?.current?.key, skills[2].key); // viewing the current one
  assert.equal(lessonContext(map, skills[5].key)?.current?.key, skills[2].key); // viewing a locked one
  const finished = buildPathMap(path, firstDone(path, skills.length));
  assert.equal(lessonContext(finished, skills[0].key)?.current, null);
});

test("buildPathMap: every lesson knows its unit and module (links between units rely on it)", () => {
  for (const p of getAllPaths()) {
    const map = buildPathMap(p, []);
    for (const unit of map.units) {
      for (const mod of unit.modules) {
        for (const lesson of mod.lessons) {
          assert.equal(lesson.unitKey, unit.key, `${p.slug}/${lesson.key}`);
          assert.equal(lesson.moduleKey, mod.key, `${p.slug}/${lesson.key}`);
        }
      }
    }
  }
});

test("lessonContext: an unknown lesson is null", () => {
  assert.equal(lessonContext(buildPathMap(path, []), "grammar.nope"), null);
});

test("isLessonOpen: finished and current lessons are open, later ones are not, unknown ones never", () => {
  const map = buildPathMap(path, firstDone(path, 2));
  assert.equal(isLessonOpen(map, skills[0].key), true);
  assert.equal(isLessonOpen(map, skills[1].key), true);
  assert.equal(isLessonOpen(map, skills[2].key), true); // current
  assert.equal(isLessonOpen(map, skills[3].key), false);
  assert.equal(isLessonOpen(map, "grammar.nope"), false);
});
