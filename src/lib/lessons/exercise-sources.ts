import { normalizeForComparison, tokenize } from "../lesson-exercises.ts";
import type { GrammarQuestion } from "../missions/grammar-bank.ts";
import type { FillBlankExercise, MultipleChoiceExercise, SentenceBuildExercise } from "./types.ts";

// Превращает реальные данные приложения в упражнения. Ничего не выдумывается:
//   • вопросы банка грамматики (missions/grammar-bank.ts) → multiple_choice /
//     fill_blank (пропуск «___» в тексте вопроса);
//   • примеры предложений из самого урока (Skill.lesson.examples) →
//     sentence_build, на основе тех же токенайзера и проверки, что у «Собери
//     фразу» в повторении (lesson-exercises.ts).
// Перемешивание детерминировано (seed из id) — без Math.random: одно и то же
// упражнение одинаково выглядит при каждой загрузке и после восстановления
// урока, а серверная проверка не зависит от того, что показал клиент.

export const BLANK_MARKER = "___";

/** Версия алгоритма перемешивания. Входит в отпечаток плана: если алгоритм
 *  изменится, открытые попытки (индексы ответов привязаны к порядку) будут
 *  начаты заново, а не интерпретированы неверно. */
export const SHUFFLE_VERSION = 1;

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items];
  const random = mulberry32(hashSeed(seed));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Вопрос банка → упражнение с выбором. Варианты перемешиваются: в банке верный
 *  ответ часто стоит первым, и «всегда выбирай первый» не должно работать. */
export function choiceExerciseFromQuestion(question: GrammarQuestion, seed: string): MultipleChoiceExercise | FillBlankExercise {
  const correctText = question.options[question.correctIndex];
  const order = seededShuffle(
    question.options.map((_, index) => index),
    `${seed}:${question.id}`,
  );
  const options = order.map((index) => question.options[index]);
  return {
    id: question.id,
    type: question.prompt.includes(BLANK_MARKER) ? "fill_blank" : "multiple_choice",
    prompt: question.prompt,
    options,
    correctIndex: options.indexOf(correctText),
    explanation: question.explanation,
  };
}

const MIN_BUILD_TOKENS = 3;
const MAX_BUILD_TOKENS = 10;

/** Пригодные для «собери предложение» примеры: 3–10 слов, без повторов. */
export function buildableExamples(examples: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const example of examples) {
    const tokens = tokenize(example);
    if (tokens.length < MIN_BUILD_TOKENS || tokens.length > MAX_BUILD_TOKENS) continue;
    const key = normalizeForComparison(example);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(example.trim());
  }
  return result;
}

/** Пример урока → «Собери предложение». Тайлы перемешаны так, чтобы исходный
 *  порядок не совпал с показанным (если это вообще возможно). */
export function sentenceBuildFromExample(example: string, seed: string, index: number): SentenceBuildExercise | null {
  const solution = tokenize(example);
  if (solution.length < MIN_BUILD_TOKENS) return null;

  const solutionKey = solution.join(" ");
  let tiles = seededShuffle(solution, `${seed}:build:${index}`);
  for (let salt = 1; tiles.join(" ") === solutionKey && salt <= 8; salt++) {
    tiles = seededShuffle(solution, `${seed}:build:${index}:${salt}`);
  }

  return {
    id: `build_${index + 1}`,
    type: "sentence_build",
    instruction: "Собери предложение из слов",
    tiles,
    solution,
    explanation: "Порядок слов — как в примере из урока.",
  };
}
