import type { LucideIcon } from "lucide-react";

// Раздел B.3 файла 10 (единая иконочная система): раньше icon был
// произвольной эмодзи-строкой ("📅"/"🔥"/"🎯") — метрики Today Plan
// функциональные (число + подпись), не тёплый/человечный контекст, поэтому
// подходят под замену на lucide, в отличие от EmptyState (осознанно
// оставлен эмодзи — см. комментарий там).
export default function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--surface)] p-3 shadow-sm">
      <span className="text-caption flex items-center gap-1">
        {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
        {label}
      </span>
      <span className="text-h3">{value}</span>
    </div>
  );
}
