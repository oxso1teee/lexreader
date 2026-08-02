export default function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-[var(--surface)] p-3 shadow-sm">
      <span className="text-caption flex items-center gap-1">
        {icon && <span aria-hidden="true">{icon}</span>}
        {label}
      </span>
      <span className="text-h3">{value}</span>
    </div>
  );
}
