import { splitIntoSentences, tokenizeSentence } from "../tokenize.ts";

// docs/moments/ROADMAP.md, этап 7 — First-text: честный процент "знакомых"
// слов текста, никакой заглушки. Считает уникальные слова-токены тела
// текста (та же токенизация, что в читалке) и сверяет их с реальным
// словарём пользователя (vocabulary_items.headword, тот же язык).
export interface TextFamiliarity {
  uniqueWordCount: number;
  knownWordCount: number;
  newWordCount: number;
  percentFamiliar: number;
}

export function computeTextFamiliarity(body: string, knownHeadwords: string[]): TextFamiliarity {
  const known = new Set(knownHeadwords.map((w) => w.toLowerCase()));
  const unique = new Set<string>();
  for (const sentence of splitIntoSentences(body)) {
    for (const token of tokenizeSentence(sentence)) {
      if (token.isWord) unique.add(token.text.toLowerCase());
    }
  }

  let knownWordCount = 0;
  for (const w of unique) {
    if (known.has(w)) knownWordCount++;
  }

  const uniqueWordCount = unique.size;
  const newWordCount = uniqueWordCount - knownWordCount;
  const percentFamiliar = uniqueWordCount > 0 ? Math.round((knownWordCount / uniqueWordCount) * 100) : 0;

  return { uniqueWordCount, knownWordCount, newWordCount, percentFamiliar };
}

export interface ExcerptToken {
  text: string;
  /** Слово, которого нет в словаре пользователя (подсвечивается). */
  isNew: boolean;
}

/** Первые предложения текста (до maxChars) с пометкой новых слов — для
 *  превью на First-text. Подсвечиваются только первые maxMarks новых
 *  слов длиной от 4 букв (служебные "a/the/was" не интересны). */
export function excerptWithNewWords(body: string, knownHeadwords: string[], maxChars = 140, maxMarks = 3): ExcerptToken[] {
  const known = new Set(knownHeadwords.map((w) => w.toLowerCase()));
  const out: ExcerptToken[] = [];
  let used = 0;
  let marks = 0;
  for (const sentence of splitIntoSentences(body)) {
    if (used > 0 && used + sentence.length > maxChars) break;
    if (used > 0) out.push({ text: " ", isNew: false });
    for (const token of tokenizeSentence(sentence)) {
      const isNew = token.isWord && token.text.length >= 4 && marks < maxMarks && !known.has(token.text.toLowerCase());
      if (isNew) marks++;
      out.push({ text: token.text, isNew });
    }
    used += sentence.length + 1;
  }
  return out;
}
