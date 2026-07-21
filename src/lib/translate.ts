/**
 * Перевод слова/фразы с учётом контекста предложения (раздел 7 ТЗ, уровень MVP).
 *
 * Провайдер по умолчанию — MyMemory: бесплатный, без ключа и без карты
 * (https://mymemory.translated.net), лимит ~5000 слов/день анонимно.
 * При росте нагрузки замени реализацию на self-hosted LibreTranslate
 * или платный DeepL — сигнатура translate() рассчитана на такую замену.
 */

export interface TranslationResult {
  wordTranslation: string;
  sentenceTranslation: string | null;
}

interface MyMemoryMatch {
  translation: string;
  match: number;
}

interface MyMemoryResponse {
  responseData: { translatedText: string };
  responseStatus: number;
  matches?: MyMemoryMatch[];
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  });
  if (process.env.MYMEMORY_CONTACT_EMAIL) {
    params.set("de", process.env.MYMEMORY_CONTACT_EMAIL);
  }

  const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
  if (!res.ok) {
    throw new Error(`MyMemory request failed: ${res.status}`);
  }

  const data = (await res.json()) as MyMemoryResponse;
  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory translation failed: ${data.responseStatus}`);
  }

  const translation = data.responseData.translatedText;

  // MyMemory иногда возвращает как лучшее совпадение непереведённую запись из
  // своей памяти переводов (особенно для отдельных слов без контекста).
  // В этом случае берём лучший реально переведённый вариант из matches.
  if (translation.trim().toLowerCase() === text.trim().toLowerCase() && data.matches?.length) {
    const better = data.matches
      .filter((m) => m.translation.trim().toLowerCase() !== text.trim().toLowerCase())
      .sort((a, b) => b.match - a.match)[0];
    if (better) return better.translation;
  }

  return translation;
}

export async function translate(
  word: string,
  sentence: string | null,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult> {
  const [wordTranslation, sentenceTranslation] = await Promise.all([
    translateText(word, sourceLang, targetLang),
    sentence ? translateText(sentence, sourceLang, targetLang) : Promise.resolve(null),
  ]);

  return { wordTranslation, sentenceTranslation };
}
