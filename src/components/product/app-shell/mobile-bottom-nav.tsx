"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { NAV_ITEMS } from "./nav-items";

// Today mockup alignment — раньше сплошная полоса снизу (border-top,
// flush с краями экрана), теперь плавающая карточка (inset 16px по
// бокам/снизу, rounded-[20px], shadow, --card фон/--border), как в
// референсе. Тот же список NAV_ITEMS (общий источник правды с
// DesktopSidebar, docs/ui/route-map.md) — 5 реальных пунктов, не 4, как
// на иллюстративном мокапе: сокращать список означало бы убрать реальный
// route/функциональность, что прямо запрещено заданием.
//
// Референс просит forest на иконке+подписи активного таба — оставлено
// как раньше (forest только на иконке, подпись — text-black/white): та
// же --color-forest на белом даёт 3.73:1 против требуемых WCAG AA
// 4.5:1 (найдено axe-core, комментарий ниже унаследован из исходного
// файла) — не переносим известный, уже раз исправленный a11y-баг обратно
// ради точного соответствия референсу.
export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="sticky bottom-4 z-20 mx-4 flex rounded-[20px] border border-[var(--border)] bg-card shadow-[0_8px_30px_-8px_rgba(0,0,0,0.25)] md:hidden"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
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
              active
                ? "text-black dark:text-white"
                : "text-[var(--text-secondary)] hover:text-black/70 dark:hover:text-white/70"
            }`}
          >
            {/* Как и в DesktopSidebar — цвет бренда на иконке (декоративная
                графика), не на тексте пункта: forest-текст на белом фоне
                давал 3.73:1 против требуемых 4.5:1 (найдено axe-core).

                forest-text-contrast-fix: голый text-forest (--color-forest,
                не переопределён в тёмной теме) не проходил даже мягкий
                3:1-порог для иконки в тёмной теме — реально измерено
                (getComputedStyle на живом рендере) ~1.72:1 иконки на
                --card. --color-forest-text (~8.6:1 против --card в тёмной
                теме) с большим запасом чист. */}
            <span className={active ? "text-[var(--color-forest-text)]" : ""} aria-hidden="true">
              <Icon />
            </span>
            <span className="leading-none">{item.label}</span>
            <span
              className={`mt-0.5 h-1 w-1 rounded-full transition-opacity ${
                active ? "bg-forest opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
