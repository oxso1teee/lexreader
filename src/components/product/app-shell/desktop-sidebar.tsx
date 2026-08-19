"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { messages } from "@/lib/i18n";
import { NAV_ITEMS } from "./nav-items";

// docs/ui/current-ui-audit.md §1: sidebar visible only from md: up
// (MobileBottomNav hidden at the same breakpoint), not a 1:1 copy of the
// mobile layout (vertical list with the label next to the icon).
//
// Gamified redesign: CSS-variable tokens instead of hardcoded `dark:`
// utilities, so this follows the explicit theme toggle correctly; active
// item now uses the cyan primary accent instead of caramel.
export default function DesktopSidebar({
  planLabel,
}: {
  planLabel: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[var(--container-sidebar)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-3 py-5 md:flex"
      aria-label="Боковая навигация"
    >
      <Link href="/home" className="focus-ring mb-6 flex items-center gap-2 px-2 text-lg font-bold tracking-tight">
        {messages.appShell.brand}
      </Link>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Основные разделы">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => track("app_nav_clicked", { destination: item.href, viewport_type: "desktop" })}
              className={`focus-ring flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[var(--color-primary)]/15 text-[var(--foreground)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <span className={active ? "text-[var(--color-primary)]" : ""} aria-hidden="true">
                <Icon />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {planLabel && (
        <Link
          href="/settings"
          className="focus-ring mt-4 truncate rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)]"
        >
          {planLabel}
        </Link>
      )}
    </aside>
  );
}
