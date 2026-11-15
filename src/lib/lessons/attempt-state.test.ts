import { test } from "node:test";
import assert from "node:assert/strict";
import { CURRICULA, findSkill } from "../learning-paths/curriculum/index.ts";
import {
  advanceContent,
  answeredResults,
  countAnswers,
  currentStep,
  isReadyToFinish,
  sanitizeStoredAnswers,
  submitExercise,
  type AttemptState,
} from "./attempt-state.ts";
import { buildLessonPlan } from "./plan.ts";
import type { ExerciseResponse, LessonPlan, ServerExercise, StoredAnswer } from "./types.ts";

const NOW = "2026-01-01T00:00:00.000Z";
const skill = findSkill(CURRICULA["a2-b1"], "grammar.present_simple")!;
const plan = buildLessonPlan(skill, "lesson")!;
const start: AttemptState = { stepIndex: 0, answers: [] };

function rightResponse(exercise: ServerExercise): ExerciseResponse {
  return exercise.type === "sentence_build"
    ? { type: "tiles", tiles: exercise.solution }
    : { type: "choice", index: exercise.correctIndex };
}

function wrongResponse(exercise: ServerExercise): ExerciseResponse {
  if (exercise.type === "sentence_build") return { type: "tiles", tiles: [...exercise.solution].reverse() };
  return { type: "choice", index: (exercise.correctIndex + 1) % exercise.options.length };
}

function readAll(p: LessonPlan, state: AttemptState): AttemptState {
  let current = state;
  for (const step of p.steps) {
    if (step.kind !== "content") break;
    const r = advanceContent(p, current, step.id);
    assert.ok(r.ok);
    current = r.state;
  }
  return current;
}

test("currentStep/isReadyToFinish следуют за позицией", () => {
  assert.equal(currentStep(plan, start)?.id, "content:intro");
  assert.equal(isReadyToFinish(plan, start), false);
  assert.equal(isReadyToFinish(plan, { stepIndex: plan.steps.length, answers: [] }), true);
  assert.equal(currentStep(plan, { stepIndex: plan.steps.length, answers: [] }), null);
});

test("контент: шаги проходятся по порядку, позиция растёт на 1", () => {
  const a = advanceContent(plan, start, "content:intro");
  assert.ok(a.ok && !a.replay);
  assert.equal(a.state.stepIndex, 1);
  const b = advanceContent(plan, a.state, "content:material");
  assert.ok(b.ok);
  assert.equal(b.state.stepIndex, 2);
});

test("контент: повторный шаг (двойной клик) — replay без изменений", () => {
  const a = advanceContent(plan, start, "content:intro");
  assert.ok(a.ok);
  const again = advanceContent(plan, a.state, "content:intro");
  assert.ok(again.ok && again.replay);
  assert.deepEqual(again.state, a.state);
});

test("контент: нельзя перепрыгнуть вперёд и нельзя назвать несуществующий/чужой шаг", () => {
  assert.deepEqual(advanceContent(plan, start, "content:material"), { ok: false, error: "out_of_sequence" });
  assert.deepEqual(advanceContent(plan, start, "content:nope"), { ok: false, error: "unknown_step" });
  assert.deepEqual(advanceContent(plan, start, ""), { ok: false, error: "unknown_step" });
  const exerciseStep = plan.steps.find((s) => s.kind === "exercise")!;
  assert.deepEqual(advanceContent(plan, start, exerciseStep.id), { ok: false, error: "unknown_step" }, "упражнение нельзя «прочитать»");
});

test("упражнение: верный и неверный ответ считаются, позиция растёт, ответ сохраняется", () => {
  let state = readAll(plan, start);
  const first = plan.exerciseOrder[0];
  const r1 = submitExercise(plan, state, first, rightResponse(plan.exercises[first]), NOW);
  assert.ok(r1.ok && !r1.replay);
  assert.equal(r1.verdict.correct, true);
  state = r1.state;

  const second = plan.exerciseOrder[1];
  const r2 = submitExercise(plan, state, second, wrongResponse(plan.exercises[second]), NOW);
  assert.ok(r2.ok);
  assert.equal(r2.verdict.correct, false);
  assert.equal(r2.state.answers.length, 2);
  assert.deepEqual(countAnswers(r2.state.answers), { correct: 1, incorrect: 1 });
  assert.equal(r2.state.stepIndex, state.stepIndex + 1);
});

test("упражнение: пустой и некорректный ответ не засчитываются и не двигают позицию", () => {
  const state = readAll(plan, start);
  const id = plan.exerciseOrder[0];
  assert.deepEqual(submitExercise(plan, state, id, undefined, NOW), { ok: false, error: "empty_response" });
  assert.deepEqual(submitExercise(plan, state, id, { type: "choice", index: 99 }, NOW), { ok: false, error: "invalid_response" });
  assert.deepEqual(submitExercise(plan, state, id, "abc", NOW), { ok: false, error: "invalid_response" });
  assert.equal(state.answers.length, 0);
});

test("упражнение: ответ вне очереди и на несуществующее упражнение отклоняется", () => {
  const state = readAll(plan, start);
  const later = plan.exerciseOrder[2];
  const r = submitExercise(plan, state, later, rightResponse(plan.exercises[later]), NOW);
  assert.deepEqual(r, { ok: false, error: "out_of_sequence" });
  assert.deepEqual(submitExercise(plan, state, "nope", { type: "choice", index: 0 }, NOW), { ok: false, error: "unknown_step" });
  assert.deepEqual(submitExercise(plan, start, plan.exerciseOrder[0], { type: "choice", index: 0 }, NOW), { ok: false, error: "out_of_sequence" }, "пока не пройден материал");
});

test("упражнение: повторная отправка возвращает СОХРАНЁННЫЙ результат и ничего не меняет — переответить нельзя", () => {
  const state = readAll(plan, start);
  const id = plan.exerciseOrder[0];
  const wrong = submitExercise(plan, state, id, wrongResponse(plan.exercises[id]), NOW);
  assert.ok(wrong.ok);
  // Пользователь «передумал» и шлёт верный ответ на то же упражнение.
  const retry = submitExercise(plan, wrong.state, id, rightResponse(plan.exercises[id]), NOW);
  assert.ok(retry.ok && retry.replay);
  assert.equal(retry.verdict.correct, false, "засчитан первый ответ");
  assert.deepEqual(retry.state, wrong.state);
  assert.deepEqual(countAnswers(retry.state.answers), { correct: 0, incorrect: 1 });
});

test("полный проход: все шаги → готов к завершению", () => {
  let state = readAll(plan, start);
  for (const id of plan.exerciseOrder) {
    const r = submitExercise(plan, state, id, rightResponse(plan.exercises[id]), NOW);
    assert.ok(r.ok);
    state = r.state;
  }
  assert.equal(isReadyToFinish(plan, state), true);
  assert.equal(state.answers.length, plan.exerciseOrder.length);
});

test("answeredResults раскрывает ответы только по уже отвеченным упражнениям", () => {
  let state = readAll(plan, start);
  const [first, second] = plan.exerciseOrder;
  const r = submitExercise(plan, state, first, wrongResponse(plan.exercises[first]), NOW);
  assert.ok(r.ok);
  state = r.state;
  const results = answeredResults(plan, state.answers);
  assert.deepEqual(Object.keys(results), [first]);
  assert.equal(results[first].verdict.correct, false);
  assert.equal(results[second], undefined);
});

test("sanitizeStoredAnswers: мусор отбрасывается, дубли схлопываются, `correct` пересчитывается из ответа", () => {
  const [first, second] = plan.exerciseOrder;
  const forged: unknown = [
    // подделанный флаг correct при неверном ответе
    { exerciseId: first, response: wrongResponse(plan.exercises[first]), correct: true, at: NOW },
    // дубль того же упражнения
    { exerciseId: first, response: rightResponse(plan.exercises[first]), correct: true, at: NOW },
    // несуществующее упражнение
    { exerciseId: "ghost", response: { type: "choice", index: 0 }, correct: true, at: NOW },
    // испорченный ответ
    { exerciseId: second, response: { type: "choice", index: 999 }, correct: true, at: NOW },
    null,
    "строка",
    42,
  ];
  const clean = sanitizeStoredAnswers(plan, forged);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].exerciseId, first);
  assert.equal(clean[0].correct, false, "флаг из БД не принимается на веру");
  assert.deepEqual(sanitizeStoredAnswers(plan, null), []);
  assert.deepEqual(sanitizeStoredAnswers(plan, { not: "array" }), []);
});

test("тип StoredAnswer хранит ответ пользователя и время", () => {
  const state = readAll(plan, start);
  const id = plan.exerciseOrder[0];
  const r = submitExercise(plan, state, id, rightResponse(plan.exercises[id]), NOW);
  assert.ok(r.ok);
  const saved: StoredAnswer = r.state.answers[0];
  assert.equal(saved.at, NOW);
  assert.equal(saved.exerciseId, id);
});
