"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isThemePreference, resolveTheme, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

// Единственная точка чтения/записи темы на клиенте. Источник истины —
// localStorage["lexreader_theme"]; атрибут data-theme на <html> до гидрации
// выставляет theme-init-script.ts, здесь он только поддерживается в
// актуальном виде (выбор пользователя + смена темы ОС в режиме «system»).
const listeners = new Set<() => void>();

function getSnapshot(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : "system";
  } catch {
    return "system";
  }
}
function getServerSnapshot(): ThemePreference {
  return "system";
}
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // другая вкладка сменила тему
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function applyTheme(preference: ThemePreference) {
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", resolveTheme(preference, systemPrefersDark));
}

export function setTheme(next: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // приватный режим/квота: тема применится на эту сессию, но не сохранится
  }
  applyTheme(next);
  listeners.forEach((l) => l());
}

export function useTheme(): { preference: ThemePreference; setTheme: (next: ThemePreference) => void } {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // В режиме «system» держим тему в синхроне со сменой темы ОС, не требуя
  // от пользователя заходить в настройки.
  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(preference);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  return { preference, setTheme };
}
