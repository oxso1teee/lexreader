"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconBook, IconCards, IconChart, IconSettings } from "@/components/icons";

const ITEMS = [
  { href: "/home", label: "Главная", Icon: IconHome },
  { href: "/library", label: "Читать/Слушать", Icon: IconBook },
  { href: "/brain", label: "Мозг", Icon: IconCards },
  { href: "/progress", label: "Статистика", Icon: IconChart },
  { href: "/settings", label: "Настройки", Icon: IconSettings },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-black/10 bg-card/95 backdrop-blur dark:border-white/10">
      {ITEMS.map(({ href, label, Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-center text-xs font-medium transition-colors ${
              active
                ? "text-accent-strong"
                : "text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="leading-none">{label}</span>
            <span
              className={`mt-0.5 h-1 w-1 rounded-full transition-opacity ${
                active ? "bg-accent opacity-100" : "opacity-0"
              }`}
            />
          </Link>
        );
      })}
    </nav>
  );
}
