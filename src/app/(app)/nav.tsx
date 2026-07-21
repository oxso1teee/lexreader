"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/library", label: "Библиотека" },
  { href: "/notebook", label: "Словарь" },
  { href: "/review", label: "Повторение" },
  { href: "/progress", label: "Прогресс" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-black/95">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
              active
                ? "text-black dark:text-white"
                : "text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
