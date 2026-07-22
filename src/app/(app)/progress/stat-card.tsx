const COLORS: Record<string, string> = {
  neutral: "text-caramel",
  orange: "text-accent-orange",
  green: "text-accent-green",
  purple: "text-accent-purple",
  blue: "text-accent-blue",
  red: "text-accent-red",
};

export default function StatCard({
  value,
  label,
  color = "neutral",
}: {
  value: number | string;
  label: string;
  color?: keyof typeof COLORS;
}) {
  return (
    <div className="rounded-2xl bg-card px-4 py-4 shadow-sm">
      <p className={`text-2xl font-bold ${COLORS[color]}`}>{value}</p>
      <p className="text-sm text-black/50 dark:text-white/50">{label}</p>
    </div>
  );
}
