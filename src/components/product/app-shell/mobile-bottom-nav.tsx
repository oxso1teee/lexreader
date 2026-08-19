"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { NAV_ITEMS } from "./nav-items";

// Замена (app)/nav.tsx: та же вёрстка/поведение, плюс aria-current для
// активного пункта и safe-area padding снизу.
//
// Gamified redesign: styling now goes entirely through the CSS-variable
// tokens (--surface/--text-secondary/--color-primary) instead of hardcoded
// `dark:` Tailwind utilities, so this nav correctly follows the explicit
// light/dark toggle (src/lib/theme.ts) rather than only the OS preference.
export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="sticky bottom-0 z-20 flex border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.Icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={() => track("app_nav_clicked", { destination: item.href, viewport_type: "mobile" })}
            className={`focus-ring flex flex-1 flex-col items-center gap-0.5 py-2.5 text-center text-xs font-medium transition-colors ${
              active ? "text-[var(--foreground)]" : "text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className={active ? "text-[var(--color-primary)]" : ""} aria-hidden="true">
              <Icon />
            </span>
            <span className="leading-none">{item.label}</span>
            <span
              className={`mt-0.5 h-1 w-1 rounded-full bg-[var(--color-primary)] transition-opacity ${
                active ? "opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
