import MetricCard from "@/components/product/metric-card";

export interface DailyPlanMetric {
  label: string;
  value: string;
  icon?: string;
}

// "Today Plan" — только реальные метрики, переданные вызывающим кодом
// (page.tsx). Компонент не решает, что показывать, только раскладывает
// готовые metric-объекты в сетку.
export default function DailyPlanCard({ metrics }: { metrics: DailyPlanMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.label} label={m.label} value={m.value} icon={m.icon} />
      ))}
    </div>
  );
}
