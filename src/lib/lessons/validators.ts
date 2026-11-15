import { checkPhraseAnswer } from "../lesson-exercises.ts";
import type { ExerciseResponse, ExerciseVerdict, ServerExercise } from "./types.ts";

// Проверка ответов по типам упражнений. Единый интерфейс — evaluateResponse()
// и checkStoredResponse(); логика у каждого типа своя и лежит в реестре
// HANDLERS. Новый тип упражнения (перевод, сопоставление, аудирование)
// добавляется записью в реестр + веткой в ServerExercise — вызывающий код
// (машина состояний, сервер, сохранение) не меняется.
//
// Чистые функции: ни сети, ни DOM, ни времени. Вход от клиента (`raw`) —
// всегда unknown и разбирается здесь, а не приводится типом.

export type ParseFailure = "empty" | "invalid";
export type ParseResult = { ok: true; response: ExerciseResponse } | { ok: false; reason: ParseFailure };

export type EvaluationResult =
  | { ok: true; response: ExerciseResponse; verdict: ExerciseVerdict }
  | { ok: false; reason: ParseFailure };

/** Защитные границы: клиент не может прислать тайл-простыню или тысячу тайлов. */
export const MAX_TILE_LENGTH = 60;
export const MAX_TILES = 24;

interface Handler<E extends ServerExercise> {
  parse(exercise: E, raw: unknown): ParseResult;
  check(exercise: E, response: ExerciseResponse): ExerciseVerdict;
}

type ChoiceExercise = Extract<ServerExercise, { type: "multiple_choice" | "fill_blank" }>;
type SentenceBuild = Extract<ServerExercise, { type: "sentence_build" }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const choiceHandler: Handler<ChoiceExercise> = {
  parse(exercise, raw) {
    if (raw === undefined || raw === null) return { ok: false, reason: "empty" };
    if (!isRecord(raw) || raw.type !== "choice") return { ok: false, reason: "invalid" };
    const index = raw.index;
    if (index === undefined || index === null) return { ok: false, reason: "empty" };
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index >= exercise.options.length) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, response: { type: "choice", index } };
  },
  check(exercise, response) {
    const correct = response.type === "choice" && response.index === exercise.correctIndex;
    return { correct, correctAnswer: exercise.options[exercise.correctIndex], explanation: exercise.explanation };
  },
};

const sentenceBuildHandler: Handler<SentenceBuild> = {
  parse(_exercise, raw) {
    if (raw === undefined || raw === null) return { ok: false, reason: "empty" };
    if (!isRecord(raw) || raw.type !== "tiles" || !Array.isArray(raw.tiles)) return { ok: false, reason: "invalid" };
    const tiles = raw.tiles;
    if (tiles.length === 0) return { ok: false, reason: "empty" };
    if (tiles.length > MAX_TILES) return { ok: false, reason: "invalid" };
    const cleaned: string[] = [];
    for (const tile of tiles) {
      if (typeof tile !== "string") return { ok: false, reason: "invalid" };
      const trimmed = tile.trim();
      if (trimmed.length === 0 || trimmed.length > MAX_TILE_LENGTH) return { ok: false, reason: "invalid" };
      cleaned.push(trimmed);
    }
    return { ok: true, response: { type: "tiles", tiles: cleaned } };
  },
  check(exercise, response) {
    // Порядок важен, регистр и конечная пунктуация — нет (та же проверка, что
    // у «Собери фразу» в повторении: lesson-exercises.ts).
    const correct = response.type === "tiles" && checkPhraseAnswer(response.tiles, exercise.solution);
    return { correct, correctAnswer: exercise.solution.join(" "), explanation: exercise.explanation };
  },
};

// Реестр: тип → обработчик. Ключи проверяются компилятором — добавив тип в
// ServerExercise и забыв обработчик, сборка не пройдёт.
const HANDLERS: { [K in ServerExercise["type"]]: Handler<Extract<ServerExercise, { type: K }>> } = {
  multiple_choice: choiceHandler,
  fill_blank: choiceHandler,
  sentence_build: sentenceBuildHandler,
};

function handlerFor<E extends ServerExercise>(exercise: E): Handler<E> {
  return HANDLERS[exercise.type] as unknown as Handler<E>;
}

/** Разбирает сырой ответ клиента и проверяет его. Пустой/некорректный ввод
 *  возвращает ok:false — такой ответ не засчитывается и не тратит попытку. */
export function evaluateResponse(exercise: ServerExercise, raw: unknown): EvaluationResult {
  const handler = handlerFor(exercise);
  const parsed = handler.parse(exercise, raw);
  if (!parsed.ok) return parsed;
  return { ok: true, response: parsed.response, verdict: handler.check(exercise, parsed.response) };
}

/** Повторно проверяет уже разобранный (сохранённый) ответ — для восстановления
 *  обратной связи при возврате в урок и для повторной отправки. */
export function checkStoredResponse(exercise: ServerExercise, response: ExerciseResponse): ExerciseVerdict {
  return handlerFor(exercise).check(exercise, response);
}

/** Сохранённый в БД jsonb мог быть испорчен вручную: перед использованием
 *  прогоняем его через тот же разбор, что и ответ клиента. */
export function parseStoredResponse(exercise: ServerExercise, raw: unknown): ParseResult {
  return handlerFor(exercise).parse(exercise, raw);
}
