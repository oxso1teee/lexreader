import Link from "next/link";

// UX fix 2026-08-07: Overview used to link out to 6 equal-weight "sections"
// (including Паттерны and Рекомендации), which made Language Twin feel like
// a set of separate tools rather than one profile. Патterns/recommendations
// are now primary content ON the Overview page itself (see page.tsx), so
// they're gone from here — what's left are genuinely secondary actions,
// rendered as a plain low-key link row (not cards) so they read as
// "also available", not as main navigation.
const SECONDARY_ACTIONS = [
  { href: "/language-twin/correction", label: "Проверить фразу" },
  { href: "/language-twin/evidence", label: "Почему LexReader так решил" },
  { href: "/language-twin/timeline", label: "История" },
  { href: "/language-twin/settings", label: "Настройки" },
];

export default function LanguageTwinSections() {
  return (
    <nav aria-label="Дополнительные действия" className="flex flex-wrap gap-x-4 gap-y-2 px-1">
      {SECONDARY_ACTIONS.map((s) => (
        <Link
          key={s.href}
          href={s.href}
          className="focus-ring text-xs text-[var(--text-secondary)] underline-offset-2 hover:underline"
        >
          {s.label}
        </Link>
      ))}
    </nav>
  );
}
