const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function DailyGoalRing({ current, goal }: { current: number; goal: number }) {
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);

  return (
    <div className="flex items-center gap-4">
      <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
        <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="currentColor" strokeWidth="6" className="text-black/10 dark:text-white/10" />
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 28 28)"
          className="text-caramel transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div>
        <p className="font-semibold">
          {current} / {goal} слов
        </p>
        <p className="text-sm text-black/50 dark:text-white/50">дневная цель</p>
      </div>
    </div>
  );
}
