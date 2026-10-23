import Link from "next/link";

// Эталон: Progress.dc.html — сегментный переключатель Неделя/Месяц/Всё время.
const PERIODS = [
  { value: "7", label: "Неделя" },
  { value: "30", label: "Месяц" },
  { value: "all", label: "Всё время" },
];

export default function PeriodTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Период" className="flex rounded-2xl bg-[var(--surface-muted)] p-1">
      {PERIODS.map((p) => {
        const on = current === p.value;
        return (
          <Link
            key={p.value}
            href={`/progress?period=${p.value}`}
            aria-current={on ? "page" : undefined}
            className={`focus-ring flex min-h-11 flex-1 items-center justify-center rounded-xl text-[15px] font-bold transition-colors ${
              on ? "bg-[var(--surface)] text-foreground shadow-[0_1px_0_rgba(0,0,0,.06)]" : "text-[var(--text-secondary)]"
            }`}
          >
            {p.label}
          </Link>
        );
      })}
    </nav>
  );
}
