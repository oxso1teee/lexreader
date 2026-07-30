import Link from "next/link";

// Заменяет premium-card.tsx: тонкая полоска вместо тёмной promo-карточки
// при каждом визите (docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, 4.2).
export default function UpsellStrip() {
  return (
    <Link
      href="/pricing"
      className="flex items-center gap-2 rounded-2xl border border-dashed border-accent/45 px-4 py-3 text-sm text-black/60 dark:text-white/60"
    >
      <span>Открой Premium — слушать и следить, импорт без лимитов</span>
      <span className="ml-auto font-bold text-accent-strong">→</span>
    </Link>
  );
}
