// Раздел B файла 10 (docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md):
// ручной переключатель тёмной/светлой темы. Раньше тема была только
// системной (`@media (prefers-color-scheme: dark)` в globals.css/tokens.css).
// "system" — не запасной вариант, а полноценное третье состояние: без него
// человек, однажды сохранивший "light"/"dark", больше никогда не увидит
// смену темы ОС, не зайдя обратно в настройки.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "lexreader_theme";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "system") return systemPrefersDark ? "dark" : "light";
  return preference;
}

// Дублируется строкой в THEME_INIT_SCRIPT (src/app/theme-init-script.ts) —
// та копия обязана быть самодостаточным текстом script'а с strategy
// beforeInteractive (выполняется до загрузки любого JS-модуля приложения,
// значит не может импортировать эту функцию). Логика обеих копий обязана
// совпадать — при изменении одной проверяй вторую.
