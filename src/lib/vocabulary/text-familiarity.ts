import { splitIntoSentences, tokenizeSentence } from "@/lib/tokenize";

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
