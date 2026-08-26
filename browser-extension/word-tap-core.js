// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице". Чистая логика (без document/chrome) —
// тестируется напрямую node:test, тот же паттерн разделения, что и
// youtube-dom-extractor.js/youtube-content-relay.js: этот файл только
// вычисляет, "живая" обвязка (chrome.storage/dblclick/Shadow DOM) — в
// word-tap.js.
(function (global) {
  // BCP-47-ish -> primary subtag, lowercase. "en-US" -> "en", "" -> null.
  function normalizeLangCode(lang) {
    if (typeof lang !== "string") return null;
    const primary = lang.trim().split(/[-_]/)[0].toLowerCase();
    return primary.length >= 2 ? primary : null;
  }

  // Раздел C, Тир 3 — детектор языка вне YouTube-контекста: читает
  // задекларированный самой страницей язык (document.documentElement.lang
  // или ближайший [lang]-предок затапнутого слова), а не гадает по
  // содержимому текста. Большинство корректно свёрстанных страниц уже дают
  // этот сигнал бесплатно; страницы без lang просто не участвуют в
  // сравнении (permissive — см. langMismatchWarning ниже).
  function normalizePageLang(rawLang) {
    return normalizeLangCode(rawLang);
  }

  // null = не блокируем (страница не задекларировала язык, или он совпадает
  // с изучаемым) — тап всё равно работает, штамп есть только когда мы
  // УВЕРЕНЫ, что страница на другом языке.
  function langMismatchWarning(pageLang, targetLang) {
    const page = normalizeLangCode(pageLang);
    const target = normalizeLangCode(targetLang);
    if (!page || !target || page === target) return null;
    return `Похоже, эта страница на «${page}», а изучаемый язык — «${target}». Перевод всё равно сработает, но слова могут быть не на изучаемом языке.`;
  }

  // Тап — только по отдельному слову (см. route.ts на бэкенде — то же
  // ограничение и там, сознательно не поддерживаем фразы вне Reader).
  // \p{L} — хотя бы одна буква (Unicode-aware), чтобы не ловить двойной
  // клик по числу/пунктуации/эмодзи.
  const WORD_RE = /^[\p{L}\p{M}'’-]+$/u;
  function isSingleWord(text) {
    if (typeof text !== "string") return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 40) return false;
    if (/\s/.test(trimmed)) return false;
    return WORD_RE.test(trimmed);
  }

  // Разбивает blockText на предложения и возвращает то, что содержит word —
  // тот же смысл "контекстного предложения", что Reader берёт из готовой
  // разметки текста, только здесь источник — сырой innerText произвольного
  // блока страницы. Без совпадения — весь блок, обрезанный до разумной
  // длины (страница выигрывает от контекста даже когда границы предложений
  // не удалось найти, а не остаётся вовсе без него).
  const MAX_CONTEXT_LENGTH = 300;
  function extractContextSentence(blockText, word) {
    if (typeof blockText !== "string" || !blockText.trim()) return "";
    const normalized = blockText.replace(/\s+/g, " ").trim();
    const needle = word.trim().toLowerCase();
    const sentences = normalized.split(/(?<=[.!?])\s+/);
    const match = sentences.find((s) => s.toLowerCase().includes(needle));
    const chosen = match ?? normalized;
    return chosen.length > MAX_CONTEXT_LENGTH ? `${chosen.slice(0, MAX_CONTEXT_LENGTH).trim()}…` : chosen;
  }

  function buildTranslateRequestBody({ word, sentence, sourceLang, targetLang }) {
    return {
      word: word.trim(),
      sentence: sentence ? sentence.trim() : "",
      sourceLang,
      targetLang,
    };
  }

  // Единая точка перевода HTTP-ответа api/extension/translate-and-save в
  // понятное сообщение — тот же набор кодов, что и сам route.ts
  // (401/400/402/429/503/502), плюс общий сетевой сбой (status=0).
  function describeApiError(status, body) {
    if (status === 401) return "Токен недействителен или отозван — обнови его в настройках расширения.";
    if (status === 429) return "Слишком много запросов на перевод — попробуй через минуту.";
    if (status === 402) return "Достигнут лимит бесплатного тарифа LexReader.";
    if (status === 0) return "Нет соединения с LexReader — проверь интернет.";
    return (body && typeof body.error === "string" && body.error) || "Не удалось получить перевод, попробуй ещё раз.";
  }

  global.LexReaderWordTapCore = Object.freeze({
    normalizeLangCode,
    normalizePageLang,
    langMismatchWarning,
    isSingleWord,
    extractContextSentence,
    buildTranslateRequestBody,
    describeApiError,
    MAX_CONTEXT_LENGTH,
  });
})(globalThis);
