"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  isThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";

const listeners = new Set<() => void>();

function getSnapshot(): ThemePreference {
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(raw) ? raw : "system";
}
function getServerSnapshot(): ThemePreference {
  return "system";
}
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function applyResolvedTheme(preference: ThemePreference) {
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.setAttribute("data-theme", resolveTheme(preference, systemPrefersDark));
}

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Светлая" },
  { value: "dark", label: "Тёмная" },
  { value: "system", label: "Системная" },
];

// Раздел B файла 10: ручной переключатель темы в интерфейсе — раньше тема
// была только системной. "system" явно хранится в localStorage (не
// "отсутствие значения"), чтобы отличать "выбрал системную" от "ещё не
// открывал настройки" — оба резолвятся одинаково сейчас, но так честнее
// для будущих миграций/аналитики.
//
// Экран 11/11 редизайна: раньше был собственной секцией-карточкой
// ("Оформление" в одиночку) — теперь только строка-переключатель, образец
// компонента-переключателя для остальных toggle'ов на этой странице
// (settings-client.tsx собирает несколько таких строк в одну карточку
// "Оформление и устройство" вместо стопки из отдельных карточек на
// каждую мелкую настройку).
export default function ThemeToggle() {
  const preference = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Применяет тему сразу при выборе и держит её в синхроне, если открыта
  // системная тема и пользователь переключил тему ОС, не заходя обратно
  // сюда (иначе "Системная" была бы live только в момент клика).
  useEffect(() => {
    applyResolvedTheme(preference);
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyResolvedTheme(preference);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function select(next: ThemePreference) {
    localStorage.setItem(THEME_STORAGE_KEY, next);
    listeners.forEach((l) => l());
  }

  return (
    <div>
      <p className="text-body-sm mb-1.5 text-[var(--text-secondary)]">Тема оформления</p>
      <div role="group" aria-label="Тема оформления" className="grid grid-cols-3 gap-1.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={preference === o.value}
            onClick={() => select(o.value)}
            className={`focus-ring flex min-h-11 items-center justify-center rounded-lg border text-body-sm font-medium transition-colors ${
              preference === o.value ? "border-forest bg-forest text-white" : "border-[var(--border-strong)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
