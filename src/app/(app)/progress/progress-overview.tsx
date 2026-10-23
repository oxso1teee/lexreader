import Link from "next/link";
import { cardClassName } from "@/components/ui/card";
import PeriodTabs from "./period-tabs";
import StatCard from "./stat-card";
import StreakSummaryCard from "./streak-summary-card";
import FiveWeekGrid from "./five-week-grid";

export interface ProgressOverviewProps {
  period: string;
  streakCurrent: number;
  streakLongest: number;
  freezeAvailable: boolean;
  knownWords: number;
  finishedTexts: number;
  weeklyXp: number;
  reviewsThisWeek: number;
  activityCounts: Record<string, number>;
  myRank: number | null;
  duel: { myScore: number; opponentScore: number; opponentInitials: string } | null;
}

export default function ProgressOverview({
  period,
  streakCurrent,
  streakLongest,
  freezeAvailable,
  knownWords,
  finishedTexts,
  weeklyXp,
  reviewsThisWeek,
  activityCounts,
  myRank,
  duel,
}: ProgressOverviewProps) {
  return (
    <>
      {/* Эталон: docs/moments/mockups/Progress.dc.html — первый экран:
          период, серия, 4 показателя недели, 5 недель активности, рейтинг
          и дуэль. Всё остальное — ниже, в «Подробнее». */}
      <h1 className="mo-disp pt-6 text-[28px] font-black leading-tight">Прогресс</h1>
      <PeriodTabs current={period} />

      <StreakSummaryCard
        days={streakCurrent}
        bestStreak={streakLongest}
        freezeAvailable={freezeAvailable}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <StatCard value={knownWords} label="Знаю слов" tone="leaf" />
        <StatCard value={finishedTexts} label="Прочитано текстов" tone="sky" />
        <StatCard value={weeklyXp} label="XP за неделю" tone="sun" />
        {/* "Минут за неделю" из макета не честно (activity_days.minutes
            никогда не заполняется, см. комментарий в daily-quests.ts) —
            реально посчитанное число повторений за неделю. */}
        <StatCard value={reviewsThisWeek} label="Повторы за неделю" tone="ember" />
      </div>

      <div className={cardClassName({ className: "flex flex-col gap-2.5" })} style={{ padding: "14px 16px" }}>
        <div className="flex items-baseline justify-between">
          <p className="text-[15px] font-bold">Последние 5 недель</p>
          <p className="text-xs text-[var(--text-secondary)]">меньше → больше</p>
        </div>
        <FiveWeekGrid counts={activityCounts} />
      </div>

      <div className="flex gap-3">
        <Link href="/leaderboard" className={cardClassName({ interactive: true, className: "focus-ring flex flex-1 flex-col gap-1.5" })}>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Рейтинг недели</p>
          <p className="mo-disp flex items-center gap-2 text-lg font-bold">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--sun-text)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
              <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
            </svg>
            {myRank ? `${myRank} место` : "—"}
          </p>
        </Link>
        {duel ? (
          <Link href="/duel" className={cardClassName({ interactive: true, className: "focus-ring flex flex-1 flex-col gap-1.5" })}>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Дуэль с {duel.opponentInitials}</p>
            <p className="flex items-baseline gap-2">
              <span className="mo-disp text-lg font-bold" style={{ color: duel.myScore >= duel.opponentScore ? "var(--leaf-text)" : undefined }}>
                {duel.myScore} : {duel.opponentScore}
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                {duel.myScore > duel.opponentScore ? "ты ведёшь" : duel.myScore < duel.opponentScore ? "догоняй" : "ничья"}
              </span>
            </p>
          </Link>
        ) : (
          <Link href="/duel" className={cardClassName({ interactive: true, className: "focus-ring flex flex-1 flex-col gap-1.5" })}>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)]">Дуэль</p>
            <p className="text-sm font-semibold">Позвать друга</p>
          </Link>
        )}
      </div>

    </>
  );
}
