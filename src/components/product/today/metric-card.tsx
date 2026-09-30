import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

// redesign/duolingo-flat, phase 6 — числовая ячейка bento на /home (минуты
// чтения, стрик, повторение). Заменяет stat-strip.tsx. tone="ember" — единственное
// сознательное отклонение от нейтральной Card: тёплая плитка стрика.
export default function MetricCard({
  icon: Icon,
  value,
  label,
  hint,
  tone = "neutral",
  className,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  hint?: string;
  tone?: "neutral" | "ember";
  className?: string;
}) {
  const ember = tone === "ember";
  return (
    <Card
      className={`flex flex-col gap-1 ${
        ember ? "border-[color-mix(in_oklab,var(--ember),transparent_50%)] bg-[var(--ember-tint)]" : ""
      } ${className ?? ""}`}
    >
      <Icon
        aria-hidden="true"
        className={`mb-1 h-6 w-6 ${ember ? "text-[var(--ember)]" : "text-[var(--color-forest)]"}`}
      />
      <p className={`font-display text-2xl font-bold ${ember ? "text-[var(--ember-text)]" : ""}`}>{value}</p>
      <p className="text-sm font-semibold">{label}</p>
      {hint && <p className="text-xs text-[var(--text-secondary)]">{hint}</p>}
    </Card>
  );
}
