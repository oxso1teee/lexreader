import Link from "next/link";

// Replaces the old LanguageTwinNav horizontal tab strip: in-content links
// instead of a persistent app-level nav bar (2026-08-07 UX fix — the strip
// made Language Twin feel like a separate app nested inside LexReader).
const SECTIONS = [
  { href: "/language-twin/patterns", label: "Посмотреть паттерны" },
  { href: "/language-twin/evidence", label: "Почему LexReader так решил" },
  { href: "/language-twin/recommendations", label: "Рекомендации" },
  { href: "/language-twin/timeline", label: "История прогресса" },
  { href: "/language-twin/correction", label: "Проверить предложение" },
  { href: "/language-twin/settings", label: "Настройки профиля" },
];

export default function LanguageTwinSections() {
  return (
    <div className="rounded-2xl bg-card p-2 shadow-sm">
      <ul className="flex flex-col divide-y divide-[var(--border)]">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="focus-ring flex items-center justify-between gap-2 rounded-xl p-3 text-sm font-medium hover:bg-[var(--surface-muted)]"
            >
              {s.label}
              <span aria-hidden="true" className="text-[var(--text-secondary)]">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
