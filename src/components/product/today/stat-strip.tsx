import type { LucideIcon } from "lucide-react";

export interface StatStripItem {
  label: string;
  value: string;
  icon: LucideIcon;
}

// Today mockup alignment — заменяет DailyPlanCard (2x4-сетка карточек,
// каждая rounded-xl bg-surface shadow-sm) компактной строкой из 3
// плиток, разделённых var(--border), как в референсе. Тот же принцип
// "один акцент", что уже применён к StatCard на /progress (PR #50) —
// иерархия через размер/вес, не через цвет (иконка/число — forest-light,
// не разноцветная радуга).
export default function StatStrip({ items }: { items: StatStripItem[] }) {
  return (
    <div className="flex rounded-2xl bg-card shadow-sm">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`flex flex-1 flex-col items-center gap-1 px-2 py-3 text-center ${
            i > 0 ? "border-l border-[var(--border)]" : ""
          }`}
        >
          <item.icon aria-hidden="true" className="h-[17px] w-[17px] text-forest-light" />
          <span className="font-mono text-[16px] font-bold">{item.value}</span>
          <span className="text-[9px] text-[var(--text-secondary)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
