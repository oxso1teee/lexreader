// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице". Инжектится по требованию через
// chrome.scripting.executeScript (activeTab + scripting — не статический
// content_scripts.matches и не <all_urls>), запускается popup.js после
// явного клика пользователя на "Включить на этой странице". Живая обвязка
// (DOM/события/Shadow DOM) — чистая логика в word-tap-core.js (тестируется
// отдельно, тот же паттерн, что и youtube-dom-extractor.js/
// youtube-content-relay.js).
(() => {
  "use strict";

  const core = globalThis.LexReaderWordTapCore;
  if (!core) {
    console.error("[LexReader:diag] word-tap-core.js was not loaded before word-tap.js");
    return;
  }

  // Повторный клик на "Включить" на уже активной странице — выключает,
  // а не плодит второй набор обработчиков (chrome.scripting.executeScript
  // не отслеживает, был ли файл уже инжектирован).
  if (window.__lexreaderWordTapActive) {
    window.__lexreaderWordTapDeactivate?.();
    return;
  }
  window.__lexreaderWordTapActive = true;

  const host = document.createElement("div");
  host.id = "lexreader-word-tap-host";
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.top = "0";
  host.style.left = "0";
  host.style.zIndex = "2147483647";
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = `
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .toast {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      background: #111;
      color: #fff;
      padding: 8px 14px;
      border-radius: 999px;
      font-size: 12px;
      box-shadow: 0 4px 16px rgba(0,0,0,.25);
      max-width: 420px;
      text-align: center;
    }
    .toast.warn { background: #9a3412; }
    .popup {
      position: fixed;
      width: 260px;
      background: #fff;
      color: #111;
      border-radius: 12px;
      box-shadow: 0 8px 28px rgba(0,0,0,.28);
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.4;
    }
    .popup .word { font-weight: 700; margin-bottom: 2px; }
    .popup .translation { color: #1a1a1a; }
    .popup .sentence { color: #666; font-size: 12px; margin-top: 6px; }
    .popup .error { color: #9a3412; }
    .popup .saved { color: #1a7f37; font-size: 11px; margin-top: 6px; }
    .popup .loading { color: #888; }
  `;
  shadow.append(style);

  let popupEl = null;
  let toastTimer = null;

  function closePopup() {
    if (popupEl) {
      popupEl.remove();
      popupEl = null;
    }
  }

  function showToast(text, tone) {
    const toast = document.createElement("div");
    toast.className = tone === "warn" ? "toast warn" : "toast";
    toast.textContent = text;
    shadow.append(toast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.remove(), 5000);
  }

  function clampPosition(x, y) {
    const width = 260;
    const margin = 12;
    const left = Math.min(Math.max(margin, x), window.innerWidth - width - margin);
    const top = Math.min(Math.max(margin, y + 16), window.innerHeight - margin - 40);
    return { left, top };
  }

  function renderPopup(x, y, state) {
    closePopup();
    const { left, top } = clampPosition(x, y);
    const el = document.createElement("div");
    el.className = "popup";
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    if (state.status === "loading") {
      el.innerHTML = `<div class="word">${escapeHtml(state.word)}</div><div class="loading">Переводим…</div>`;
    } else if (state.status === "error") {
      el.innerHTML = `<div class="word">${escapeHtml(state.word)}</div><div class="error">${escapeHtml(state.message)}</div>`;
    } else {
      el.innerHTML = `
        <div class="word">${escapeHtml(state.word)}</div>
        <div class="translation">${escapeHtml(state.translation)}</div>
        ${state.sentenceTranslation ? `<div class="sentence">${escapeHtml(state.sentenceTranslation)}</div>` : ""}
        <div class="saved">Сохранено в словарь ✓</div>
      `;
    }
    shadow.append(el);
    popupEl = el;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text ?? "";
    return div.innerHTML;
  }

  const BLOCK_SELECTOR = "p, li, td, th, div, span, h1, h2, h3, h4, h5, h6, blockquote, figcaption, article, section";

  async function handleDblClick(event) {
    const selection = window.getSelection();
    const text = selection ? selection.toString() : "";
    if (!core.isSingleWord(text)) return;
    const word = text.trim();

    const config = await chrome.storage.local.get(["apiToken", "sourceLang", "targetLang", "apiBaseUrl"]);
    if (!config.apiToken) {
      showToast("LexReader: открой popup расширения и сохрани токен, чтобы включить тап-перевод.", "warn");
      return;
    }

    const blockEl = event.target.closest?.(BLOCK_SELECTOR) ?? event.target;
    const sentence = core.extractContextSentence(blockEl?.innerText ?? blockEl?.textContent ?? "", word);
    const body = core.buildTranslateRequestBody({
      word,
      sentence,
      sourceLang: config.sourceLang ?? "en",
      targetLang: config.targetLang ?? "ru",
    });

    renderPopup(event.clientX, event.clientY, { status: "loading", word });
    const response = await chrome.runtime
      .sendMessage({
        type: "LEXREADER_WORD_TAP_TRANSLATE",
        body,
        apiToken: config.apiToken,
        apiBaseUrl: config.apiBaseUrl ?? "https://lexreader.app",
      })
      .catch(() => null);

    if (!response?.ok) {
      renderPopup(event.clientX, event.clientY, {
        status: "error",
        word,
        message: core.describeApiError(response?.status ?? 0, response?.body),
      });
      return;
    }
    renderPopup(event.clientX, event.clientY, {
      status: "success",
      word,
      translation: response.body.wordTranslation,
      sentenceTranslation: response.body.sentenceTranslation,
    });
  }

  function handleOutsideClick(event) {
    if (!popupEl) return;
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (!path.includes(popupEl)) closePopup();
  }

  function handleKeydown(event) {
    if (event.key === "Escape") closePopup();
  }

  document.addEventListener("dblclick", handleDblClick, true);
  document.addEventListener("click", handleOutsideClick, true);
  document.addEventListener("keydown", handleKeydown, true);

  window.__lexreaderWordTapDeactivate = () => {
    document.removeEventListener("dblclick", handleDblClick, true);
    document.removeEventListener("click", handleOutsideClick, true);
    document.removeEventListener("keydown", handleKeydown, true);
    clearTimeout(toastTimer);
    host.remove();
    window.__lexreaderWordTapActive = false;
    delete window.__lexreaderWordTapDeactivate;
  };

  (async () => {
    // sourceLang — "изучаю" (the language being studied), the one that
    // should match the PAGE's declared language. targetLang is the native/
    // translation-output language and has nothing to do with what the page
    // itself is written in — comparing against it would warn on every page
    // in the studied language whenever it differs from the user's native one.
    const config = await chrome.storage.local.get(["sourceLang"]);
    const pageLang = core.normalizePageLang(document.documentElement.lang);
    const warning = config.sourceLang ? core.langMismatchWarning(pageLang, config.sourceLang) : null;
    showToast(
      warning ? `LexReader включён. ${warning}` : "LexReader: тап-перевод включён — дважды кликни по слову.",
      warning ? "warn" : undefined,
    );
  })();
})();
