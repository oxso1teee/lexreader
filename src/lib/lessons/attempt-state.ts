import { checkStoredResponse, evaluateResponse, parseStoredResponse, type ParseFailure } from "./validators.ts";
import type { ExerciseResponse, ExerciseVerdict, LessonPlan, LessonStep, StoredAnswer } from "./types.ts";

// Машина состояний попытки. Позиция (stepIndex) — число уже пройденных шагов
// плана; шаг пройден, когда сервер принял переход (контент) или засчитал ответ
// (упражнение). Это единственное место, где решается «можно ли сейчас сделать
// такой переход»: клиент лишь просит, сервер отвечает.
//
// Все функции чистые и идемпотентные по отношению к повтору: повторная
// отправка того же шага возвращает replay:true и НЕ меняет состояние.

export interface AttemptState {
  stepIndex: number;
  answers: StoredAnswer[];
}

export type TransitionError = "unknown_step" | "out_of_sequence" | "empty_response" | "invalid_response";

export type AdvanceResult =
  | { ok: true; state: AttemptState; replay: boolean }
  | { ok: false; error: TransitionError };

export type SubmitResult =
  | { ok: true; state: AttemptState; response: ExerciseResponse; verdict: ExerciseVerdict; replay: boolean }
  | { ok: false; error: TransitionError };

export function currentStep(plan: LessonPlan, state: AttemptState): LessonStep | null {
  return plan.steps[state.stepIndex] ?? null;
}

export function isReadyToFinish(plan: LessonPlan, state: AttemptState): boolean {
  return state.stepIndex >= plan.steps.length;
}

export function countAnswers(answers: readonly StoredAnswer[]): { correct: number; incorrect: number } {
  let correct = 0;
  for (const answer of answers) if (answer.correct) correct++;
  return { correct, incorrect: answers.length - correct };
}

function failureToError(reason: ParseFailure): TransitionError {
  return reason === "empty" ? "empty_response" : "invalid_response";
}

/** Переход «прочитал» для шага с содержимым (введение, материал, ошибки). */
export function advanceContent(plan: LessonPlan, state: AttemptState, stepId: string): AdvanceResult {
  const index = plan.steps.findIndex((step) => step.id === stepId);
  if (index < 0 || plan.steps[index].kind !== "content") return { ok: false, error: "unknown_step" };
  if (index < state.stepIndex) return { ok: true, state, replay: true };
  if (index > state.stepIndex) return { ok: false, error: "out_of_sequence" };
  return { ok: true, state: { ...state, stepIndex: state.stepIndex + 1 }, replay: false };
}

/** Ответ на упражнение. Некорректный/пустой ответ не засчитывается и не
 *  двигает позицию; повторный ответ на уже пройденное упражнение возвращает
 *  сохранённый результат (а не новый — переответить нельзя). */
export function submitExercise(plan: LessonPlan, state: AttemptState, exerciseId: string, raw: unknown, now: string): SubmitResult {
  const exercise = plan.exercises[exerciseId];
  const index = plan.steps.findIndex((step) => step.kind === "exercise" && step.exerciseId === exerciseId);
  if (!exercise || index < 0) return { ok: false, error: "unknown_step" };

  if (index < state.stepIndex) {
    const stored = state.answers.find((answer) => answer.exerciseId === exerciseId);
    if (!stored) return { ok: false, error: "out_of_sequence" };
    const parsed = parseStoredResponse(exercise, stored.response);
    if (!parsed.ok) return { ok: false, error: "invalid_response" };
    return { ok: true, state, response: parsed.response, verdict: checkStoredResponse(exercise, parsed.response), replay: true };
  }
  if (index > state.stepIndex) return { ok: false, error: "out_of_sequence" };

  const evaluated = evaluateResponse(exercise, raw);
  if (!evaluated.ok) return { ok: false, error: failureToError(evaluated.reason) };

  const answer: StoredAnswer = { exerciseId, response: evaluated.response, correct: evaluated.verdict.correct, at: now };
  return {
    ok: true,
    state: { stepIndex: state.stepIndex + 1, answers: [...state.answers, answer] },
    response: evaluated.response,
    verdict: evaluated.verdict,
    replay: false,
  };
}

export interface AnsweredResult {
  response: ExerciseResponse;
  verdict: ExerciseVerdict;
}

/** Результаты всех уже отвеченных упражнений — для восстановления обратной
 *  связи после перезагрузки и для просмотра пройденных шагов. Правильные
 *  ответы раскрываются только по тем упражнениям, на которые пользователь уже
 *  ответил. Повреждённые записи пропускаются. */
export function answeredResults(plan: LessonPlan, answers: readonly StoredAnswer[]): Record<string, AnsweredResult> {
  const results: Record<string, AnsweredResult> = {};
  for (const answer of answers) {
    const exercise = plan.exercises[answer.exerciseId];
    if (!exercise) continue;
    const parsed = parseStoredResponse(exercise, answer.response);
    if (!parsed.ok) continue;
    results[answer.exerciseId] = { response: parsed.response, verdict: checkStoredResponse(exercise, parsed.response) };
  }
  return results;
}

/** Ответы из БД — это jsonb: оставляем только структурно верные записи по
 *  упражнениям плана, без дублей. Защита от ручной порчи строки. */
export function sanitizeStoredAnswers(plan: LessonPlan, raw: unknown): StoredAnswer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: StoredAnswer[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const exerciseId = record.exerciseId;
    if (typeof exerciseId !== "string" || seen.has(exerciseId)) continue;
    const exercise = plan.exercises[exerciseId];
    if (!exercise) continue;
    const parsed = parseStoredResponse(exercise, record.response);
    if (!parsed.ok) continue;
    seen.add(exerciseId);
    // `correct` пересчитываем из ответа, а не верим сохранённому флагу.
    result.push({
      exerciseId,
      response: parsed.response,
      correct: checkStoredResponse(exercise, parsed.response).correct,
      at: typeof record.at === "string" ? record.at : "",
    });
  }
  return result;
}
