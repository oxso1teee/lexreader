// Разбивка текста читалки на предложения и слова-токены для tap-to-translate.
// Каждое слово — отдельный лёгкий токен (раздел 10 ТЗ: не перерисовывать весь текст на тап).

// P0-АУДИТ 3.10: автоматические (ASR) субтитры YouTube часто вообще без
// знаков препинания — без этого лимита весь транскрипт становится ОДНИМ
// "предложением", а значит одной страницей читалки (пагинация режет только
// границы между предложениями), и TTS пытается озвучить весь текст разом.
const MAX_SENTENCE_WORDS = 60;
const CHUNK_WORDS = 30;

function splitLongChunk(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= MAX_SENTENCE_WORDS) return [text];

  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += CHUNK_WORDS) {
    chunks.push(words.slice(i, i + CHUNK_WORDS).join(" "));
  }
  return chunks;
}

export function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+|\n+/u)
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap(splitLongChunk);
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
