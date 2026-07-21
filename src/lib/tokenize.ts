// Разбивка текста читалки на предложения и слова-токены для tap-to-translate.
// Каждое слово — отдельный лёгкий токен (раздел 10 ТЗ: не перерисовывать весь текст на тап).

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

export interface Token {
  text: string;
  isWord: boolean;
}

export function tokenizeSentence(sentence: string): Token[] {
  const parts = sentence.split(/(\p{L}[\p{L}\p{N}''-]*)/u);
  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({ text: p, isWord: /^\p{L}/u.test(p) }));
}
