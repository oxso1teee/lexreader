import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_TILES, MAX_TILE_LENGTH, checkStoredResponse, evaluateResponse, parseStoredResponse } from "./validators.ts";
import type { FillBlankExercise, MultipleChoiceExercise, SentenceBuildExercise } from "./types.ts";

const choice: MultipleChoiceExercise = {
  id: "q1",
  type: "multiple_choice",
  prompt: "Выбери верный порядок слов:",
  options: ["Where do you live?", "Where you do live?", "Do you where live?"],
  correctIndex: 0,
  explanation: "Вопросительное слово + вспомогательный глагол + подлежащее.",
};

const blank: FillBlankExercise = {
  id: "q2",
  type: "fill_blank",
  prompt: "She ___ to work every day.",
  options: ["go", "goes", "going"],
  correctIndex: 1,
  explanation: "С she добавляется -s.",
};

const build: SentenceBuildExercise = {
  id: "build_1",
  type: "sentence_build",
  instruction: "Собери предложение",
  tiles: ["every", "work", "I", "day."],
  solution: ["I", "work", "every", "day."],
  explanation: "Порядок как в примере.",
};

// ---------- выбор (multiple_choice / fill_blank) ----------

test("choice: верный индекс засчитывается и раскрывает правильный ответ и объяснение", () => {
  const result = evaluateResponse(choice, { type: "choice", index: 0 });
  assert.ok(result.ok);
  assert.equal(result.verdict.correct, true);
  assert.equal(result.verdict.correctAnswer, "Where do you live?");
  assert.equal(result.verdict.explanation, choice.explanation);
});

test("choice: неверный индекс не засчитывается, но показывает правильный ответ", () => {
  const result = evaluateResponse(choice, { type: "choice", index: 2 });
  assert.ok(result.ok);
  assert.equal(result.verdict.correct, false);
  assert.equal(result.verdict.correctAnswer, "Where do you live?");
});

test("fill_blank проверяется тем же обработчиком выбора", () => {
  const right = evaluateResponse(blank, { type: "choice", index: 1 });
  const wrong = evaluateResponse(blank, { type: "choice", index: 0 });
  assert.ok(right.ok && wrong.ok);
  assert.equal(right.verdict.correct, true);
  assert.equal(right.verdict.correctAnswer, "goes");
  assert.equal(wrong.verdict.correct, false);
});

test("choice: пустой ввод (нет ответа) — empty, не неверный ответ", () => {
  for (const raw of [undefined, null, { type: "choice" }, { type: "choice", index: null }]) {
    const result = evaluateResponse(choice, raw);
    assert.deepEqual(result, { ok: false, reason: "empty" }, JSON.stringify(raw));
  }
});

test("choice: некорректный ввод отклоняется (индекс вне диапазона, дробный, строка, NaN, чужой тип)", () => {
  const bad: unknown[] = [
    { type: "choice", index: -1 },
    { type: "choice", index: 3 },
    { type: "choice", index: 1.5 },
    { type: "choice", index: "0" },
    { type: "choice", index: Number.NaN },
    { type: "choice", index: Infinity },
    { type: "tiles", tiles: ["a"] },
    { index: 0 },
    "0",
    0,
    [0],
  ];
  for (const raw of bad) {
    const result = evaluateResponse(choice, raw);
    assert.equal(result.ok, false, JSON.stringify(raw));
    if (!result.ok) assert.notEqual(result.reason, undefined);
  }
});

// ---------- sentence_build ----------

test("sentence_build: верный порядок засчитывается", () => {
  const result = evaluateResponse(build, { type: "tiles", tiles: ["I", "work", "every", "day."] });
  assert.ok(result.ok);
  assert.equal(result.verdict.correct, true);
  assert.equal(result.verdict.correctAnswer, "I work every day.");
});

test("sentence_build: регистр и конечная пунктуация не важны, порядок — важен", () => {
  const folded = evaluateResponse(build, { type: "tiles", tiles: ["i", "WORK", "every", "day"] });
  const wrongOrder = evaluateResponse(build, { type: "tiles", tiles: ["work", "I", "every", "day."] });
  assert.ok(folded.ok && wrongOrder.ok);
  assert.equal(folded.verdict.correct, true);
  assert.equal(wrongOrder.verdict.correct, false);
});

test("sentence_build: неполный или лишний набор тайлов — неверно, а не ошибка ввода", () => {
  const short = evaluateResponse(build, { type: "tiles", tiles: ["I", "work"] });
  const long = evaluateResponse(build, { type: "tiles", tiles: ["I", "work", "every", "day.", "day."] });
  assert.ok(short.ok && long.ok);
  assert.equal(short.verdict.correct, false);
  assert.equal(long.verdict.correct, false);
});

test("sentence_build: тайлы обрезаются по краям, пустые тайлы — некорректный ввод", () => {
  const padded = evaluateResponse(build, { type: "tiles", tiles: [" I ", "work", "every", "day. "] });
  assert.ok(padded.ok);
  assert.equal(padded.verdict.correct, true);
  assert.deepEqual(evaluateResponse(build, { type: "tiles", tiles: ["I", "  "] }), { ok: false, reason: "invalid" });
});

test("sentence_build: пустой массив — empty; не массив/не строки/слишком много/слишком длинно — invalid", () => {
  assert.deepEqual(evaluateResponse(build, { type: "tiles", tiles: [] }), { ok: false, reason: "empty" });
  assert.deepEqual(evaluateResponse(build, undefined), { ok: false, reason: "empty" });
  const invalid: unknown[] = [
    { type: "tiles", tiles: "I work" },
    { type: "tiles", tiles: [1, 2] },
    { type: "tiles", tiles: [null] },
    { type: "tiles", tiles: Array.from({ length: MAX_TILES + 1 }, () => "a") },
    { type: "tiles", tiles: ["x".repeat(MAX_TILE_LENGTH + 1)] },
    { type: "choice", index: 0 },
    { tiles: ["I"] },
  ];
  for (const raw of invalid) {
    assert.deepEqual(evaluateResponse(build, raw), { ok: false, reason: "invalid" }, JSON.stringify(raw)?.slice(0, 80));
  }
});

test("sentence_build: дефис и апостроф внутри слова сохраняются при сравнении", () => {
  const exercise: SentenceBuildExercise = { ...build, solution: ["I", "don't", "like", "well-known", "tea."], tiles: [] };
  const ok = evaluateResponse(exercise, { type: "tiles", tiles: ["I", "don't", "like", "well-known", "tea."] });
  const bad = evaluateResponse(exercise, { type: "tiles", tiles: ["I", "dont", "like", "well-known", "tea."] });
  assert.ok(ok.ok && bad.ok);
  assert.equal(ok.verdict.correct, true);
  assert.equal(bad.verdict.correct, false);
});

// ---------- сохранённые ответы ----------

test("checkStoredResponse/parseStoredResponse: повторная проверка совпадает с первичной", () => {
  const first = evaluateResponse(choice, { type: "choice", index: 2 });
  assert.ok(first.ok);
  const parsed = parseStoredResponse(choice, first.response);
  assert.ok(parsed.ok);
  assert.deepEqual(checkStoredResponse(choice, parsed.response), first.verdict);
});

test("parseStoredResponse: испорченный jsonb из БД не принимается", () => {
  assert.equal(parseStoredResponse(choice, { type: "choice", index: 99 }).ok, false);
  assert.equal(parseStoredResponse(build, { type: "choice", index: 0 }).ok, false);
});
