import { cardClassName } from "@/components/ui/card";

// tone — цветная карточка показателя из Progress.dc.html: точка-маркер у
// подписи и крупное число Unbounded в цвет. Без tone — прежняя
// нейтральная карточка для блока «Подробнее» (один акцент, иерархия
// размером, см. историю файла).
const TONES = {
  leaf: { dot: "var(--leaf)", text: "var(--leaf-text)" },
  sky: { dot: "#0b79b0", text: "var(--sky-text)" },
  sun: { dot: "var(--sun)", text: "var(--sun-text)" },
  ember: { dot: "var(--ember)", text: "var(--ember-text)" },
} as const;

export default function StatCard({
  value,
  label,
  size = "secondary",
  tone,
}: {
  value: number | string;
  label: string;
  size?: "primary" | "secondary";
  tone?: keyof typeof TONES;
}) {
  if (tone) {
    const t = TONES[tone];
    return (
      <div className={cardClassName({ className: "flex min-w-0 flex-col gap-1.5" })} style={{ padding: "12px 14px 14px" }}>
        <p className="flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-[var(--text-secondary)]">
          <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: t.dot }} />
          {label}
        </p>
        <p className="mo-disp text-[24px] font-black leading-none" style={{ color: t.text }}>
          {value}
        </p>
      </div>
    );
  }
  return (
    <div className={cardClassName()}>
      {/* --color-forest-text: ~9.6:1 light / ~8.6:1 dark против --card. */}
      <p className={size === "primary" ? "text-3xl font-bold text-[var(--color-forest-text)]" : "text-xl font-semibold text-[var(--color-forest-text)]"}>{value}</p>
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
    </div>
  );
}
