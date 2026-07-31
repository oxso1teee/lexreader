export const LANGUAGES = [
  { code: "en", name: "Английский" },
  { code: "es", name: "Испанский" },
  { code: "fr", name: "Французский" },
  { code: "de", name: "Немецкий" },
  { code: "it", name: "Итальянский" },
  { code: "pt", name: "Португальский" },
  { code: "ru", name: "Русский" },
  { code: "zh", name: "Китайский" },
  { code: "ja", name: "Японский" },
  { code: "ko", name: "Корейский" },
  { code: "tr", name: "Турецкий" },
  { code: "pl", name: "Польский" },
  { code: "nl", name: "Нидерландский" },
  { code: "sv", name: "Шведский" },
  { code: "ar", name: "Арабский" },
] as const;

export function languageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

// Раздел 5 промта 2026-07-30 (запуск): библиотека и стартовые колоды пока
// есть только для английского — честно помечаем остальные языки "Скоро"
// вместо того, чтобы выглядеть одинаково готовыми.
export const READY_LANGUAGES: readonly string[] = ["en"];
