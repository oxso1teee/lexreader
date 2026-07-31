"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, LibraryIcon, BrainIcon, ProgressIcon, SettingsIcon } from "@/components/nav-icons";

const ITEMS = [
  { href: "/home", label: "Главная", Icon: HomeIcon },
  { href: "/library", label: "Читать/Слушать", Icon: LibraryIcon },
  { href: "/brain", label: "Мозг", Icon: BrainIcon },
  { href: "/progress", label: "Статистика", Icon: ProgressIcon },
  { href: "/settings", label: "Настройки", Icon: SettingsIcon },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-black/10 bg-card/95 backdrop-blur dark:border-white/10">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.Icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-center text-xs font-medium transition-colors ${
              active
                ? "text-caramel"
                : "text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            <Icon />
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
