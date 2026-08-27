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
      <p className={size === "primary" ? "text-3xl font-bold text-forest" : "text-xl font-semibold text-forest"}>{value}</p>
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}
