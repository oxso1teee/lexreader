import Link from "next/link";

const PERIODS = [
  { value: "7", label: "7 дней" },
  { value: "30", label: "30 дней" },
  { value: "90", label: "90 дней" },
  { value: "all", label: "Всё время" },
];

export default function PeriodTabs({ current }: { current: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={`/progress?period=${p.value}`}
          className={`flex min-h-11 items-center rounded-full border px-3 text-sm font-medium transition-colors ${
            current === p.value
              ? "border-accent bg-accent text-white"
              : "border-black/15 hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
          }`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}
