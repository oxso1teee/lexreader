import { Card } from "@/components/ui/card";

const RING_RADIUS = 24;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// redesign/duolingo-flat, phase 6 — ячейка bento "Дневная цель". Метрика та
// же, что раньше рисовало кольцо в hero-card.tsx: новые слова сегодня /
// profile.daily_word_goal (единственная дневная цель, которую профиль
// реально хранит). rotate(-90deg) на svg — дуга стартует с 12 часов.
export default function DailyGoalCard({ done, goal, className }: { done: number; goal: number; className?: string }) {
  const percent = goal > 0 ? Math.max(0, Math.min(100, Math.round((done / goal) * 100))) : 0;
  const dashOffset = RING_CIRCUMFERENCE * (1 - percent / 100);

  return (
    <Card className={`flex items-center gap-4 ${className ?? ""}`}>
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="28" cy="28" r={RING_RADIUS} fill="none" stroke="var(--surface-muted)" strokeWidth="6" />
          <circle
            cx="28"
            cy="28"
            r={RING_RADIUS}
            fill="none"
            stroke="var(--color-forest)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold">
          {percent}%
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold">
          {done}/{goal}
        </p>
        <p className="text-sm font-semibold">Дневная цель</p>
        <p className="text-xs text-[var(--text-secondary)]">новых слов сегодня</p>
      </div>
    </Card>
  );
}
