"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { messages } from "@/lib/i18n";
import { NAV_ITEMS } from "./nav-items";

// docs/ui/current-ui-audit.md §1: до этого компонента desktop-навигации не
// существовало вообще — bottom nav рендерился одинаково на 1440px и на
// 360px. Этот sidebar виден только от md: и выше (MobileBottomNav скрыт
// той же точкой), не копирует мобильную вёрстку 1:1 (вертикальный список
// с подписями рядом с иконкой, а не колонка иконка-над-текстом).
export default function DesktopSidebar({
  planLabel,
}: {
  planLabel: string | null;
}) {
  const pathname = usePathname();

  return (
    <aside
      className="sticky top-0 hidden h-screen w-[var(--container-sidebar)] shrink-0 flex-col border-r border-black/10 bg-card px-3 py-5 md:flex dark:border-white/10"
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
                  ? "bg-caramel/15 text-black dark:text-white"
                  : "text-black/60 hover:bg-black/5 hover:text-black/90 dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white/90"
              }`}
            >
              {/* Цвет бренда остаётся на иконке (декоративная графика —
                  для неё действует другой, более мягкий порог WCAG, не
                  4.5:1 как для текста) — сам текст пункта меню использует
                  text-black/white, иначе contrast был 3.16:1 против
                  требуемых 4.5:1 (найдено axe-core, e2e/unified-shell-a11y.spec.ts). */}
              <span className={active ? "text-caramel" : ""} aria-hidden="true">
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
          className="focus-ring mt-4 truncate rounded-xl border border-black/10 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] dark:border-white/10"
        >
          {planLabel}
        </Link>
      )}
    </aside>
  );
}
