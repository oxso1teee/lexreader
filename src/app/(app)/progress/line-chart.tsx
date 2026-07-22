export default function LineChart({
  title,
  points,
  color = "#a67c52",
}: {
  title: string;
  points: { label: string; value: number }[];
  color?: string;
}) {
  const total = points.reduce((s, p) => s + p.value, 0);
  const max = Math.max(1, ...points.map((p) => p.value));
  const w = 300;
  const h = 80;
  const step = points.length > 1 ? w / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i * step : w / 2;
    const y = h - (p.value / max) * (h - 10) - 5;
    return { x, y };
  });
  const path = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-2 text-sm text-black/50 dark:text-white/50">{total} за период</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
        <polyline
          points={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeDasharray={total === 0 ? "4 4" : undefined}
          opacity={total === 0 ? 0.4 : 1}
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-black/40 dark:text-white/40">
        {points.length > 0 && (
          <>
            <span>{points[0].label}</span>
            <span>{points[points.length - 1].label}</span>
          </>
        )}
      </div>
    </div>
  );
}
