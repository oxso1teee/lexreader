"use client";

import { useEffect, useState } from "react";
import { getEffectiveTheme, setTheme, type Theme } from "@/lib/theme";

// Gamified redesign — small light/dark switch. Dark is the app default;
// this only ever reflects/changes an EXPLICIT override. Placed on the new
// Profile page and inside Settings (see src/lib/theme.ts for why there's
// no DB column).
export default function ThemeToggle({ className = "" }: { className?: string }) {
  // Starts null so the toggle doesn't render a possibly-wrong state before
  // mount (the actual applied theme is already correct via the inline
  // script in layout.tsx -- this local state is only for this control's
  // own pressed/unpressed appearance).
  const [theme, setLocalTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // Same pattern as mic-button.tsx: defer through a timeout instead of
    // calling setState synchronously in the effect body.
    const timeout = window.setTimeout(() => setLocalTheme(getEffectiveTheme()), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  if (theme === null) {
    return <div className={`h-11 w-full animate-pulse rounded-full bg-[var(--surface-muted)] ${className}`} aria-hidden="true" />;
  }

  const options: { value: Theme; label: string }[] = [
    { value: "dark", label: "Тёмная" },
    { value: "light", label: "Светлая" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Тема оформления"
      className={`flex rounded-full bg-[var(--surface-muted)] p-1 ${className}`}
    >
      {options.map((option) => {
        const active = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setTheme(option.value);
              setLocalTheme(option.value);
            }}
            className={`focus-ring flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              active
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
