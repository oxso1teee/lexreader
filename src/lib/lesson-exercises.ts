// docs/moments/ROADMAP.md, этап 8 — Lesson-build («собери фразу из слов») и
// Lesson-listen («на слух»). Чистые функции: генерация заданий и проверка
// ответа не трогают React/DOM/сеть, поэтому покрыты обычными unit-тестами
// (lesson-exercises.test.ts), а компоненты-режимы (lesson-build-mode.tsx,
// lesson-listen-mode.tsx) только вызывают их и держат UI-state.

/** Разбивает фразу на слова по пробелам — пунктуация остаётся приклеенной
 *  к слову (тайл "вечеринки." — это и есть честный кусок исходного текста,
 *  не придуманная токенизация). */
export function tokenize(text: string): string[] {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/** Для сравнения ответа — регистр и пунктуация не важны (как в Lesson-listen.dc.html).
 *  Схлопывает несколько пробелов и убирает конечную/начальную пунктуацию у
 *  каждого слова, но НЕ трогает дефисы/апострофы внутри слова (don't, well-known). */
export function normalizeForComparison(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:"'«»…]+(?=\s|$)/g, "")
    .replace(/^[.,!?;:"'«»…]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface BuildPhraseExercise {
  /** Исходная фраза на изучаемом языке (произносится/показывается сверху). */
  promptText: string;
  /** Тайлы в перемешанном порядке — то, что видит пользователь. */
  tiles: string[];
  /** Правильный порядок тайлов для составления ответа (подмножество tiles). */
  solution: string[];
}

const MAX_DISTRACTOR_TILES = 4;

/** docs/moments/mockups/Lesson-build.dc.html — "Собери перевод": тайлы
 *  ответа (слова answerText) + несколько тайлов-пустышек из переводов других
 *  карточек пользователя (distractorAnswers), чтобы выбор был настоящим, не
 *  "один верный порядок без альтернатив". Без пустышек (нет других карточек)
 *  упражнение всё равно корректно — просто без шума.
 *  shuffle — внедряется параметром (не Math.random внутри) ради
 *  детерминированных тестов; вызывающий код передаёт настоящий shuffle. */
export function buildPhraseExercise(
  promptText: string,
  answerText: string,
  distractorAnswers: string[],
  shuffle: <T>(arr: T[]) => T[],
): BuildPhraseExercise {
  const solution = tokenize(answerText);
  const solutionWordSet = new Set(solution.map((w) => normalizeForComparison(w)));

  const distractorPool = distractorAnswers.flatMap((a) => tokenize(a));
  const distractorTiles: string[] = [];
  for (const word of shuffle(distractorPool)) {
    if (distractorTiles.length >= MAX_DISTRACTOR_TILES) break;
    if (solutionWordSet.has(normalizeForComparison(word))) continue;
    if (distractorTiles.some((d) => normalizeForComparison(d) === normalizeForComparison(word))) continue;
    distractorTiles.push(word);
  }

  return {
    promptText,
    tiles: shuffle([...solution, ...distractorTiles]),
    solution,
  };
}

/** Сравнение собранной пользователем последовательности тайлов с решением —
 *  порядок важен (это и есть "собери фразу"), регистр/конечная пунктуация —
 *  не важны (та же логика, что и в normalizeForComparison). */
export function checkPhraseAnswer(selectedTiles: string[], solution: string[]): boolean {
  if (selectedTiles.length !== solution.length) return false;
  return selectedTiles.every((tile, i) => normalizeForComparison(tile) === normalizeForComparison(solution[i]));
}

/** docs/moments/mockups/Lesson-listen.dc.html — "Напиши, что услышишь":
 *  сравнение ответа пользователя с проговорённым текстом, без учёта
 *  регистра/пунктуации (подпись на макете буквально об этом говорит). */
export function checkListenAnswer(userInput: string, spokenText: string): boolean {
  return normalizeForComparison(userInput) === normalizeForComparison(spokenText);
}
