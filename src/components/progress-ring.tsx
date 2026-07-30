// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 3.3: общее кольцо
// прогресса — вынесено из home/daily-goal-ring.tsx, переиспользуется в
// карточках колод (brain/deck-card.tsx).
export default function ProgressRing({
  size = 44,
  strokeWidth = 5,
  ratio,
  color = "var(--color-accent)",
  trackColor = "var(--color-paper-sunken)",
}: {
  size?: number;
  strokeWidth?: number;
  ratio: number;
  color?: string;
  trackColor?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, ratio)));
  const c = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={c} cy={c} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
      <circle
        cx={c}
        cy={c}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${c} ${c})`}
        className="transition-[stroke-dashoffset] duration-500"
      />
    </svg>
  );
}
