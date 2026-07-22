"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/home", label: "Главная", icon: "🏠" },
  { href: "/library", label: "Читать/Слушать", icon: "📖" },
  { href: "/brain", label: "Мозг", icon: "🧠" },
  { href: "/progress", label: "Статистика", icon: "📊" },
  { href: "/notebook", label: "Тетрадь", icon: "✏️" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-black/10 bg-card/95 backdrop-blur dark:border-white/10">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
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
            <span className="text-lg leading-none">{item.icon}</span>
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
