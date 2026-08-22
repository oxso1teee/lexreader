// Текст для <Script strategy="beforeInteractive"> в src/app/layout.tsx —
// должен выполниться до первой отрисовки, поэтому не может быть импортом
// из src/lib/theme.ts (тот код ещё не загружен на этой стадии). Логика —
// сознательно урезанная копия resolveTheme()/isThemePreference() оттуда;
// при изменении одной обнови вторую.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var v = localStorage.getItem("lexreader_theme");
    var pref = v === "light" || v === "dark" || v === "system" ? v : "system";
    var dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  } catch (e) {}
})();
`;
