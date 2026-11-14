import { test } from "node:test";
import assert from "node:assert/strict";
import {
  doneOfLessons,
  lessonPosition,
  lessonsCount,
  modulesCount,
  nextStepLabel,
  opensAfterLesson,
  opensAfterUnit,
  pathProgressLine,
  unitsCount,
} from "./copy.ts";
import { LESSON_KIND_LABEL, lessonKind } from "./lesson-kind.ts";
import { getAllPaths, getAllSkills } from "./curriculum/index.ts";
import { PATHS_ALL_HREF, PATHS_CATALOG_HREF, checkHref, lessonHref, pathHref, unitHref } from "./routes.ts";

test("routes: addresses match the app router (/learning-paths/[pathSlug]/[stageKey]/[skillKey]/check)", () => {
  const lesson = { unitKey: "core-sentence-building", key: "grammar.articles" };
  assert.equal(PATHS_CATALOG_HREF, "/learning-paths");
  assert.equal(PATHS_ALL_HREF, "/learning-paths?all=1");
  assert.equal(pathHref("a2-b1"), "/learning-paths/a2-b1");
  assert.equal(unitHref("a2-b1", "core-sentence-building"), "/learning-paths/a2-b1/core-sentence-building");
  assert.equal(lessonHref("a2-b1", lesson), "/learning-paths/a2-b1/core-sentence-building/grammar.articles");
  assert.equal(checkHref("a2-b1", lesson), "/learning-paths/a2-b1/core-sentence-building/grammar.articles/check");
});

test("lessonsCount / modulesCount: Russian plural forms", () => {
  assert.equal(lessonsCount(1), "1 урок");
  assert.equal(lessonsCount(2), "2 урока");
  assert.equal(lessonsCount(5), "5 уроков");
  assert.equal(lessonsCount(11), "11 уроков");
  assert.equal(lessonsCount(21), "21 урок");
  assert.equal(unitsCount(1), "1 раздел");
  assert.equal(unitsCount(4), "4 раздела");
  assert.equal(unitsCount(5), "5 разделов");
  assert.equal(modulesCount(1), "1 модуль");
  assert.equal(modulesCount(2), "2 модуля");
  assert.equal(modulesCount(7), "7 модулей");
});

test("doneOfLessons: the noun after «из» is in the genitive", () => {
  assert.equal(doneOfLessons(0, 1), "0 из 1 урока");
  assert.equal(doneOfLessons(1, 2), "1 из 2 уроков");
  assert.equal(doneOfLessons(3, 9), "3 из 9 уроков");
  assert.equal(doneOfLessons(2, 21), "2 из 21 урока");
  assert.equal(doneOfLessons(5, 18), "5 из 18 уроков");
});

test("pathProgressLine: units and lessons in one line", () => {
  assert.equal(
    pathProgressLine({ doneUnits: 2, totalUnits: 5, doneLessons: 19, totalLessons: 47 }),
    "2 из 5 разделов · 19 из 47 уроков",
  );
  assert.equal(
    pathProgressLine({ doneUnits: 0, totalUnits: 4, doneLessons: 0, totalLessons: 18 }),
    "0 из 4 разделов · 0 из 18 уроков",
  );
});

test("nextStepLabel: «Начать» until there is any progress, then «Продолжить»", () => {
  assert.equal(nextStepLabel(false), "Начать");
  assert.equal(nextStepLabel(true), "Продолжить");
});

test("lock hints and lesson position", () => {
  assert.equal(opensAfterLesson("Past Simple"), "Откроется после урока «Past Simple»");
  assert.equal(opensAfterUnit(3), "Откроется после раздела 3");
  assert.equal(lessonPosition(3, 5), "Урок 3 из 5");
});

test("lessonKind: every real lesson key resolves to a known kind through its namespace (no silent fallback)", () => {
  for (const path of getAllPaths()) {
    for (const skill of getAllSkills(path)) {
      const namespace = skill.key.split(".")[0];
      assert.ok(namespace in LESSON_KIND_LABEL, `${path.slug}/${skill.key}: add «${namespace}» to LESSON_KIND_LABEL`);
    }
  }
  assert.equal(lessonKind("grammar.articles"), "grammar");
  assert.equal(lessonKind("vocabulary.collocations"), "vocabulary");
  assert.equal(lessonKind("reading.general"), "reading");
  assert.equal(lessonKind("writing.correction"), "writing");
  assert.equal(lessonKind("topic.small_talk"), "topic");
  assert.equal(lessonKind("something.new"), "topic");
});
