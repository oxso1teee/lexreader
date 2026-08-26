// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3.
// Popup — единственная точка настройки: токен, языковая пара, адрес сервера
// (для локальной разработки) и кнопка активации на текущей вкладке.
// Мирроит src/lib/languages.ts — отдельный, не-бандлящийся контекст
// расширения не может импортировать модуль приложения напрямую.
"use strict";

const LANGUAGES = [
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
];

// Тот же ALLOWED_APP_ORIGINS, что и в background.mjs (allowed-origins.test.mjs
// держит их в синхроне) — только продовые/дев-варианты, без шумного списка
// preview-URL'ов деплоя (те не для конечного пользователя).
const API_BASES = [
  { url: "https://lexreader.app", label: "lexreader.app (прод)" },
  { url: "https://lexreader.vercel.app", label: "lexreader.vercel.app" },
  { url: "http://localhost:3000", label: "localhost:3000 (разработка)" },
];
const DEFAULT_API_BASE = API_BASES[0].url;

const els = {
  apiToken: document.getElementById("apiToken"),
  saveTokenBtn: document.getElementById("saveTokenBtn"),
  tokenStatus: document.getElementById("tokenStatus"),
  sourceLang: document.getElementById("sourceLang"),
  targetLang: document.getElementById("targetLang"),
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  activateBtn: document.getElementById("activateBtn"),
  activateStatus: document.getElementById("activateStatus"),
  settingsLink: document.getElementById("settingsLink"),
};

function populateSelect(select, options, selected) {
  select.innerHTML = "";
  for (const opt of options) {
    const el = document.createElement("option");
    el.value = opt.code ?? opt.url;
    el.textContent = opt.name ?? opt.label;
    if (el.value === selected) el.selected = true;
    select.append(el);
  }
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(["apiToken", "sourceLang", "targetLang", "apiBaseUrl"]);
  return {
    apiToken: stored.apiToken ?? "",
    sourceLang: stored.sourceLang ?? "en",
    targetLang: stored.targetLang ?? "ru",
    apiBaseUrl: stored.apiBaseUrl ?? DEFAULT_API_BASE,
  };
}

function setStatus(el, text, tone) {
  el.textContent = text;
  el.className = tone ?? "";
}

async function init() {
  const config = await loadConfig();

  els.apiToken.value = config.apiToken;
  setStatus(els.tokenStatus, config.apiToken ? "Токен сохранён." : "Токен не задан.", config.apiToken ? "ok" : "warn");

  populateSelect(els.sourceLang, LANGUAGES, config.sourceLang);
  populateSelect(els.targetLang, LANGUAGES, config.targetLang);
  populateSelect(els.apiBaseUrl, API_BASES, config.apiBaseUrl);
  els.settingsLink.href = `${config.apiBaseUrl}/settings`;

  els.sourceLang.addEventListener("change", () => chrome.storage.local.set({ sourceLang: els.sourceLang.value }));
  els.targetLang.addEventListener("change", () => chrome.storage.local.set({ targetLang: els.targetLang.value }));
  els.apiBaseUrl.addEventListener("change", () => {
    chrome.storage.local.set({ apiBaseUrl: els.apiBaseUrl.value });
    els.settingsLink.href = `${els.apiBaseUrl.value}/settings`;
  });

  els.saveTokenBtn.addEventListener("click", async () => {
    const token = els.apiToken.value.trim();
    if (!token) {
      setStatus(els.tokenStatus, "Вставь токен из настроек LexReader.", "warn");
      return;
    }
    await chrome.storage.local.set({ apiToken: token });
    setStatus(els.tokenStatus, "Токен сохранён.", "ok");
  });

  els.activateBtn.addEventListener("click", async () => {
    setStatus(els.activateStatus, "Включаю…", "");
    els.activateBtn.disabled = true;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error("no_active_tab");
      if (!/^https?:/.test(tab.url ?? "")) {
        setStatus(els.activateStatus, "Эта страница недоступна расширениям браузера.", "warn");
        return;
      }
      const current = await loadConfig();
      if (!current.apiToken) {
        setStatus(els.activateStatus, "Сначала сохрани токен выше.", "warn");
        return;
      }
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["word-tap-core.js", "word-tap.js"],
      });
      setStatus(els.activateStatus, "Включено — дважды кликни по слову на странице.", "ok");
      setTimeout(() => window.close(), 900);
    } catch (e) {
      setStatus(els.activateStatus, "Не удалось включить на этой странице.", "warn");
      console.error("[LexReader:diag] activate failed", e);
    } finally {
      els.activateBtn.disabled = false;
    }
  });
}

init();
