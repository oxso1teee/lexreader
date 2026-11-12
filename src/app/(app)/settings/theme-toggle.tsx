"use client";

import { useTheme } from "@/lib/ui/use-theme";
import type { ThemePreference } from "@/lib/theme";

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
// Состояние темы и запись в localStorage/data-theme — в src/lib/ui/use-theme.ts
// (единая точка, общая для всего приложения).
export default function ThemeToggle() {
  const { preference, setTheme: select } = useTheme();

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
