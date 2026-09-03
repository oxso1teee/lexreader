// feat/hybrid-gamification-visuals: раньше каждая карточка красилась в свой
// цвет из радуги (neutral/orange/green/purple/blue/red) — на одном экране
// с ~14 карточками это не читалось как иерархия, только как шум. Один
// акцент (forest) для всех чисел; "важная"/"второстепенная" метрика теперь
// разница в размере/жирности шрифта, а не в цвете — см. выбор size="primary"
// по местам вызова в page.tsx.
export default function StatCard({
  value,
  label,
  size = "secondary",
}: {
  value: number | string;
  label: string;
  size?: "primary" | "secondary";
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-4 shadow-sm">
      {/* forest-text-contrast-fix: text-forest resolves to --color-forest,
          which isn't overridden for dark theme in tokens.css — same dark
          green on a dark card, axe-core measured ~1.3-1.7:1 (found via PR
          #80). --color-forest-text is the token tokens.css already defines
          specifically for this: identical #1f4d3b in light, brighter
          #34d399 in dark. Verified ~9.6:1 light / ~8.6:1 dark against
          --card. */}
      <p className={size === "primary" ? "text-3xl font-bold text-[var(--color-forest-text)]" : "text-xl font-semibold text-[var(--color-forest-text)]"}>{value}</p>
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}
