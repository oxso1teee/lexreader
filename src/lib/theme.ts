// Gamified redesign — light/dark theme preference. Dark (the new reference
// palette) is the default appearance app-wide; this module only tracks an
// EXPLICIT user override, stored client-side (no DB column — a visual
// preference, not account data). See src/app/globals.css /
// src/styles/tokens.css for the actual token values, and the inline script
// in src/app/layout.tsx for how this avoids a flash-of-wrong-theme on load.
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "lexreader-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** Reads the stored preference, if any. Never throws (private-browsing /
 * storage-disabled contexts silently fall back to "no preference"). */
export function getStoredTheme(): Theme | null {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

/** Persists the preference and stamps `data-theme` on <html> immediately
 * (so the change is visible without a reload). */
export function setTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage unavailable -- the attribute below still applies for this
    // page load, it just won't persist across a reload.
  }
  document.documentElement.setAttribute("data-theme", theme);
}

/** No explicit choice yet: same courtesy this app has always used --
 * honor an OS light preference, otherwise fall back to the new dark
 * default. Recomputed on every load (not persisted) so it keeps tracking
 * the OS setting until the user makes an explicit choice. */
export function getDefaultTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Stored preference if any, else the OS-derived default. This is the
 * "what theme is actually in effect" answer, used by both the anti-flash
 * script and ThemeToggle's initial UI state so they can never disagree. */
export function getEffectiveTheme(): Theme {
  return getStoredTheme() ?? getDefaultTheme();
}

/** The literal source for the inline anti-flash script in layout.tsx --
 * kept here as the single source of truth for what that script does, even
 * though Next.js needs it inlined as a string (can't import a module
 * before hydration). Mirror any change here into layout.tsx by hand.
 * Always stamps an explicit data-theme (falling back to the same OS-light
 * courtesy as getDefaultTheme()) so Tailwind's `dark:` variant --
 * remapped to `[data-theme="dark"]` in globals.css -- and the CSS-variable
 * tokens in tokens.css never disagree about which theme is active. */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark";}document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;
