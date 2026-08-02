"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@/lib/posthog-client";
import { NAV_ITEMS } from "./nav-items";

// Замена (app)/nav.tsx: та же вёрстка/поведение (сохраняем существующий
// UX, docs/ui/current-ui-audit.md §2), плюс aria-current для активного
// пункта (был 0 в исходном файле) и safe-area padding снизу (viewportFit
// теперь "cover" в src/app/layout.tsx — без paddingBottom здесь контент
// nav оказался бы под home-indicator на iOS).
export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Основная навигация"
      className="sticky bottom-0 z-20 flex border-t border-black/10 bg-card/95 backdrop-blur dark:border-white/10 md:hidden"
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
              active
                ? "text-black dark:text-white"
                : "text-[var(--text-secondary)] hover:text-black/70 dark:hover:text-white/70"
            }`}
          >
            {/* Как и в DesktopSidebar — цвет бренда на иконке (декоративная
                графика), не на тексте пункта: caramel-текст на белом фоне
                давал 3.73:1 против требуемых 4.5:1 (найдено axe-core). Это
                унаследовано из исходного (app)/nav.tsx один в один — не
                новая регрессия, но раз тестируем именно этот компонент
                заново, чиним заодно. */}
            <span className={active ? "text-caramel" : ""} aria-hidden="true">
              <Icon />
            </span>
            <span className="leading-none">{item.label}</span>
            <span
              className={`mt-0.5 h-1 w-1 rounded-full transition-opacity ${
                active ? "bg-caramel opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
