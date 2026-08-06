import Link from "next/link";

const LINKS = [
  { href: "/language-twin", label: "Обзор" },
  { href: "/language-twin/patterns", label: "Паттерны" },
  { href: "/language-twin/evidence", label: "Свидетельства" },
  { href: "/language-twin/recommendations", label: "Рекомендации" },
  { href: "/language-twin/timeline", label: "История" },
  { href: "/language-twin/correction", label: "Проверка предложения" },
  { href: "/language-twin/diagnostic", label: "Диагностика" },
  { href: "/language-twin/settings", label: "Настройки" },
];

// Simple link row (not client-side tab state) so each screen is a real,
// bookmarkable route — matches how Brain's deck sub-pages work, not the
// Words/Phrases/Decks client-tab pattern (there's no shared parent state to
// preserve here between these screens).
export default function LanguageTwinNav({ current }: { current: string }) {
  return (
    <nav aria-label="Разделы Мой английский" className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1">
      {LINKS.map((link) => {
        const active = link.href === current;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`focus-ring shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-[var(--border-strong)] text-[var(--text-secondary)] hover:text-black dark:hover:text-white"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
