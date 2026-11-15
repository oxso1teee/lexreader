// Reading Engine R2 — оценка сложности английского текста без внешних сервисов и без БД.
//
// Считается по двум честным признакам:
//   • покрытие NGSL — доля слов текста (с повторами), входящих в 2809 самых частотных лемм
//     (src/lib/ngsl-data.ts, словоформы сопоставляются правилами R1);
//   • средняя длина предложения в словах.
// Плюс персональное: сколько уникальных слов пользователь ещё не сохранял.
//
// Уровень CEFR здесь — грубая ОЦЕНКА по порогам ниже, не сертификация текста; в интерфейсе
// он подписывается как «≈ B1». Для не-английских текстов и слишком коротких отрывков — null.

import { NGSL_WORDS } from "../ngsl-data.ts";
import { createFormIndex } from "../lemma.ts";
import { splitIntoSentences, tokenizeSentence } from "../tokenize.ts";

export type EstimatedCefr = "A2" | "B1" | "B2" | "C1";

export interface TextDifficulty {
  cefr: EstimatedCefr;
  /** Доля слов текста (с повторами) из NGSL, 0–100. */
  ngslCoverage: number;
  /** Среднее число слов в предложении, 1 знак после запятой. */
  avgSentenceWords: number;
  uniqueWords: number;
  /** Уникальные слова, которых нет среди сохранённых (с учётом словоформ). */
  newWords: number;
  /** newWords / uniqueWords, 0–100. */
  percentNew: number;
}

/** Всё, что умеет отвечать «знакомо ли слово»: индекс из createFormIndex. */
export interface KnownWords {
  find(word: string): unknown;
}

/** Анализируем не больше этого числа символов: оценка по началу текста, цена O(1) на материал. */
export const SAMPLE_CHARS = 20_000;
/** Меньше слов — оценка шумит, лучше не показывать. */
export const MIN_SAMPLE_WORDS = 30;

let ngslIndex: ReturnType<typeof createFormIndex<true>> | null = null;
function ngsl() {
  ngslIndex ??= createFormIndex(Object.fromEntries(NGSL_WORDS.map((w) => [w, true as const])), "en");
  return ngslIndex;
}

/** Пороги: чем выше покрытие NGSL и короче предложения, тем проще текст. */
export function cefrFromMetrics(ngslCoverage: number, avgSentenceWords: number): EstimatedCefr {
  if (ngslCoverage >= 95 && avgSentenceWords <= 12) return "A2";
  if (ngslCoverage >= 92 && avgSentenceWords <= 17) return "B1";
  if (ngslCoverage >= 88 && avgSentenceWords <= 24) return "B2";
  return "C1";
}

export function estimateTextDifficulty(body: string, known: KnownWords, language = "en"): TextDifficulty | null {
  if (language !== "en") return null;
  const sample = body.length > SAMPLE_CHARS ? body.slice(0, SAMPLE_CHARS) : body;
  const index = ngsl();

  let totalWords = 0;
  let inNgsl = 0;
  let sentenceCount = 0;
  const unique = new Set<string>();

  for (const sentence of splitIntoSentences(sample)) {
    const words = tokenizeSentence(sentence).filter((t) => t.isWord);
    if (words.length === 0) continue;
    sentenceCount++;
    words.forEach((token, i) => {
      // Имена собственные (с заглавной не в начале предложения) не отражают сложность лексики.
      if (i > 0 && /^\p{Lu}/u.test(token.text)) return;
      totalWords++;
      if (index.find(token.text)) inNgsl++;
      unique.add(token.text.toLowerCase());
    });
  }

  if (totalWords < MIN_SAMPLE_WORDS || sentenceCount === 0) return null;

  let newWords = 0;
  for (const w of unique) if (!known.find(w)) newWords++;

  const ngslCoverage = Math.round((inNgsl / totalWords) * 100);
  const avgSentenceWords = Math.round((totalWords / sentenceCount) * 10) / 10;
  return {
    cefr: cefrFromMetrics(ngslCoverage, avgSentenceWords),
    ngslCoverage,
    avgSentenceWords,
    uniqueWords: unique.size,
    newWords,
    percentNew: unique.size > 0 ? Math.round((newWords / unique.size) * 100) : 0,
  };
}
