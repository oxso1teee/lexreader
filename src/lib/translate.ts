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

interface MyMemoryResponse {
  responseData: { translatedText: string };
  responseStatus: number;
}

async function myMemoryTranslate(
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

  return data.responseData.translatedText;
}

export async function translate(
  word: string,
  sentence: string | null,
  sourceLang: string,
  targetLang: string,
): Promise<TranslationResult> {
  const [wordTranslation, sentenceTranslation] = await Promise.all([
    myMemoryTranslate(word, sourceLang, targetLang),
    sentence ? myMemoryTranslate(sentence, sourceLang, targetLang) : Promise.resolve(null),
  ]);

  return { wordTranslation, sentenceTranslation };
}
