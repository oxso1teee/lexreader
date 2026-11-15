// Reading Engine R3 — ключи и порядок поиска в общем кэше переводов (translations_cache).
//
// Таблица уже есть и защищена (0001/0014: запись только service_role), схема не меняется.
// Раньше ключом служила точная строка, поэтому «Walked» и «walked» (слово в начале и в
// середине предложения) считались разными записями и каждый раз шли во внешний сервис.
// Теперь: одиночное слово — по нижнему регистру, фраза — с нормализованными пробелами;
// старые записи (ключ = точный текст) продолжают находиться.

/** Ключ кэша: лишние пробелы схлопнуты; одиночное слово — в нижнем регистре. */
export function normalizeTranslationKey(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, " ");
  return /\s/.test(collapsed) ? collapsed : collapsed.toLowerCase();
}

/** Ключи в порядке проверки: сначала точный текст (старые записи), затем нормализованный. */
export function cacheLookupKeys(text: string): string[] {
  const exact = text.trim();
  const normalized = normalizeTranslationKey(text);
  return exact === normalized ? [normalized] : [exact, normalized];
}

/**
 * Ищет перевод по ключам по очереди. Запросы по одному ключу (`eq`), а не `in(...)`:
 * тексты предложений содержат запятые, скобки и кавычки, которые ломают синтаксис списка PostgREST.
 */
export async function lookupCachedTranslation(
  text: string,
  fetchBySourceText: (sourceText: string) => PromiseLike<string | null>,
): Promise<string | null> {
  for (const key of cacheLookupKeys(text)) {
    const found = await fetchBySourceText(key);
    if (found !== null) return found;
  }
  return null;
}
