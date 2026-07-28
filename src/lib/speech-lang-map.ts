// Web Speech API (SpeechRecognition) хочет BCP-47 локаль (en-US), а не
// ISO 639-1 код языка, который мы используем в остальном приложении
// (src/lib/languages.ts) — тот же принцип разных кодовых пространств, что и
// в ocr-lang-map.ts.
export const SPEECH_LANG: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  pt: "pt-PT",
  ru: "ru-RU",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  tr: "tr-TR",
  pl: "pl-PL",
  nl: "nl-NL",
  sv: "sv-SE",
  ar: "ar-SA",
};
