import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULA, findSkill } from "../learning-paths/curriculum/index.ts";
import { buildLessonPlan, toPublicSteps } from "./plan.ts";
import {
  canGoBack,
  clampView,
  describePrimary,
  exercisePosition,
  hasDraft,
  progressRatio,
  resumeView,
  stepCounter,
  type PlayerPosition,
} from "./player-model.ts";

const lesson = toPublicSteps(buildLessonPlan(findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!, "lesson")!);
const reading = toPublicSteps(buildLessonPlan(findSkill(CURRICULA["a2-b1"], "vocabulary.active_recall")!, "lesson")!);
const check = toPublicSteps(buildLessonPlan(findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!, "check")!);

function at(steps: PlayerPosition["steps"], over: Partial<PlayerPosition>): PlayerPosition {
  return { steps, stepIndex: 0, view: 0, answeredIds: new Set(), draft: null, ...over };
}

const exerciseId = (steps: typeof lesson, view: number) => steps[view].exercise!.id;

test("введение: «Начать» двигает сервер на шаг вперёд", () => {
  assert.deepEqual(describePrimary(at(lesson, {})), { kind: "advance", label: "Начать", disabled: false });
});

test("материал → «Далее», последний шаг с содержимым перед упражнениями → «К упражнениям»", () => {
  assert.deepEqual(describePrimary(at(lesson, { stepIndex: 1, view: 1 })), { kind: "advance", label: "Далее", disabled: false });
  assert.deepEqual(describePrimary(at(lesson, { stepIndex: 2, view: 2 })), { kind: "advance", label: "К упражнениям", disabled: false });
});

test("упражнение без ответа: «Проверить» недоступна, пока нет черновика, и объясняет почему", () => {
  const firstExercise = lesson.findIndex((s) => s.kind === "exercise");
  const empty = describePrimary(at(lesson, { stepIndex: firstExercise, view: firstExercise }));
  assert.equal(empty.kind, "submit");
  assert.equal(empty.disabled, true);
  assert.match(empty.hint ?? "", /Выбери ответ/);

  const ready = describePrimary(at(lesson, { stepIndex: firstExercise, view: firstExercise, draft: { type: "choice", index: 1 } }));
  assert.deepEqual(ready, { kind: "submit", label: "Проверить", disabled: false, hint: undefined });
});

test("упражнение «собери предложение»: подсказка про сборку, черновик — непустой список тайлов", () => {
  const build = lesson.findIndex((s) => s.exercise?.type === "sentence_build");
  assert.ok(build > 0);
  const position = at(lesson, { stepIndex: build, view: build });
  assert.match(describePrimary(position).hint ?? "", /Собери предложение/);
  assert.equal(describePrimary({ ...position, draft: { type: "tiles", tiles: [] } }).disabled, true);
  assert.equal(describePrimary({ ...position, draft: { type: "tiles", tiles: ["I"] } }).disabled, false);
});

test("отвеченное упражнение: «Далее» (без сервера), а на последнем шаге — «Завершить урок»", () => {
  const first = lesson.findIndex((s) => s.kind === "exercise");
  const answered = new Set([exerciseId(lesson, first)]);
  assert.deepEqual(describePrimary(at(lesson, { stepIndex: first + 1, view: first, answeredIds: answered })), {
    kind: "next",
    label: "Далее",
    disabled: false,
  });
  const last = lesson.length - 1;
  const lastAnswered = new Set([exerciseId(lesson, last)]);
  assert.deepEqual(describePrimary(at(lesson, { stepIndex: lesson.length, view: last, answeredIds: lastAnswered })), {
    kind: "finish",
    label: "Завершить урок",
    disabled: false,
  });
});

test("просмотр пройденного содержимого — «Далее» без обращения к серверу", () => {
  assert.deepEqual(describePrimary(at(lesson, { stepIndex: 5, view: 1 })), { kind: "next", label: "Далее", disabled: false });
});

test("все шаги приняты (после перезагрузки): панель завершения", () => {
  assert.deepEqual(describePrimary(at(lesson, { stepIndex: lesson.length, view: lesson.length })), {
    kind: "finish",
    label: "Завершить урок",
    disabled: false,
  });
});

test("читательский урок: последний шаг с содержимым сразу завершает урок", () => {
  const last = reading.length - 1;
  assert.deepEqual(describePrimary(at(reading, { stepIndex: last, view: last })), { kind: "advance", label: "Завершить урок", disabled: false });
});

test("быстрая проверка начинается сразу с упражнения", () => {
  assert.equal(check[0].kind, "exercise");
  assert.equal(describePrimary(at(check, {})).kind, "submit");
});

test("resumeView: продолжаем с первого непринятого шага, не дальше конца плана", () => {
  assert.equal(resumeView(0, 8), 0);
  assert.equal(resumeView(3, 8), 3);
  assert.equal(resumeView(8, 8), 8);
  assert.equal(resumeView(99, 8), 8);
  assert.equal(resumeView(-4, 8), 0);
});

test("progressRatio считается по принятым шагам и не выходит из [0,1]", () => {
  assert.equal(progressRatio(0, 8), 0);
  assert.equal(progressRatio(4, 8), 0.5);
  assert.equal(progressRatio(8, 8), 1);
  assert.equal(progressRatio(20, 8), 1);
  assert.equal(progressRatio(3, 0), 0);
});

test("stepCounter и canGoBack", () => {
  assert.equal(stepCounter(0, 8), "Шаг 1 из 8");
  assert.equal(stepCounter(8, 8), "Шаг 8 из 8", "на панели завершения не «9 из 8»");
  assert.equal(canGoBack(0), false);
  assert.equal(canGoBack(1), true);
});

test("clampView: назад не дальше начала, вперёд не дальше принятого сервером", () => {
  assert.equal(clampView(-1, 3, 8), 0);
  assert.equal(clampView(5, 3, 8), 3);
  assert.equal(clampView(2, 3, 8), 2);
  assert.equal(clampView(9, 99, 8), 8);
});

test("exercisePosition: номер среди упражнений, null для содержимого", () => {
  const first = lesson.findIndex((s) => s.kind === "exercise");
  const total = lesson.filter((s) => s.kind === "exercise").length;
  assert.equal(exercisePosition(lesson, 0), null);
  assert.deepEqual(exercisePosition(lesson, first), { number: 1, total });
  assert.deepEqual(exercisePosition(lesson, lesson.length - 1), { number: total, total });
});

test("hasDraft: пустые и некорректные черновики не считаются ответом", () => {
  assert.equal(hasDraft(null), false);
  assert.equal(hasDraft({ type: "choice", index: 0 }), true);
  assert.equal(hasDraft({ type: "choice", index: -1 }), false);
  assert.equal(hasDraft({ type: "choice", index: Number.NaN }), false);
  assert.equal(hasDraft({ type: "tiles", tiles: [] }), false);
  assert.equal(hasDraft({ type: "tiles", tiles: ["a"] }), true);
});
