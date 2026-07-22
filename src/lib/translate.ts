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

export class TranslationQuotaError extends Error {
  constructor() {
    super("Сервис перевода временно перегружен — дневная квота исчерпана.");
    this.name = "TranslationQuotaError";
  }
}

interface MyMemoryMatch {
  translation: string;
  match: number;
}

interface MyMemoryResponse {
  responseData: { translatedText: string };
  responseStatus: number;
  responseDetails?: string;
  quotaFinished?: boolean;
  matches?: MyMemoryMatch[];
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 300;
const REQUEST_TIMEOUT_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Ретраи только для временных сбоев (сеть/таймаут/5xx) — не для 4xx/квоты,
// которые повторный запрос всё равно не исправит.
function isRetryable(e: unknown): boolean {
  if (e instanceof TranslationQuotaError) return false;
  if (e instanceof Error && e.name === "AbortError") return true;
  if (e instanceof Error && /MyMemory request failed: 5\d\d/.test(e.message)) return true;
  if (e instanceof TypeError) return true; // сетевая ошибка fetch
  return false;
}

async function fetchMyMemory(text: string, sourceLang: string, targetLang: string): Promise<MyMemoryResponse> {
  const params = new URLSearchParams({
    q: text,
    langpair: `${sourceLang}|${targetLang}`,
  });
  if (process.env.MYMEMORY_CONTACT_EMAIL) {
    params.set("de", process.env.MYMEMORY_CONTACT_EMAIL);
  }

  const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`MyMemory request failed: ${res.status}`);
  }

  const data = (await res.json()) as MyMemoryResponse;
  if (data.quotaFinished) {
    throw new TranslationQuotaError();
  }
  if (data.responseStatus !== 200) {
    throw new Error(`MyMemory translation failed: ${data.responseStatus}`);
  }
  return data;
}

export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const data = await fetchMyMemory(text, sourceLang, targetLang);
      const translation = data.responseData.translatedText;

      // MyMemory иногда возвращает как лучшее совпадение непереведённую запись
      // из своей памяти переводов (особенно для отдельных слов без контекста).
      // В этом случае берём лучший реально переведённый вариант из matches.
      if (translation.trim().toLowerCase() === text.trim().toLowerCase() && data.matches?.length) {
        const better = data.matches
          .filter((m) => m.translation.trim().toLowerCase() !== text.trim().toLowerCase())
          .sort((a, b) => b.match - a.match)[0];
        if (better) return better.translation;
      }

      return translation;
    } catch (e) {
      lastError = e;
      if (attempt < MAX_ATTEMPTS && isRetryable(e)) {
        await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }
      break;
    }
  }

  throw lastError;
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
