import Link from "next/link";
import { rankForXp } from "@/lib/ranks";

const RADIUS = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Раздел 5 промта 2026-07-30 (композиция): DailyGoalRing + StatRow +
// ContinueReadingCard сливаются в одну "сцену дня" — то единственное
// главное, что видно на Главной без прокрутки, вместо трёх карточек
// одного веса вперемешку с остальными. Сверху — звание/XP из части 4
// промта (сквозной прогресс вместо трёх разных счётчиков).
export default function TodayCard({
  current,
  goal,
  streak,
  dueCount,
  newWordsToday,
  continueReading,
  xp,
}: {
  current: number;
  goal: number;
  streak: number;
  dueCount: number;
  newWordsToday: number;
  continueReading: { textId: string; title: string; percentRead: number } | null;
  xp: number;
}) {
  const ratio = goal > 0 ? Math.min(1, current / goal) : 0;
  const offset = CIRCUMFERENCE * (1 - ratio);
  const rank = rankForXp(xp);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-br from-caramel to-caramel-light p-4 text-white shadow-sm">
      <div className="rounded-xl bg-white/15 px-3 py-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wide">{rank.title}</span>
          {rank.nextTitle && (
            <span className="text-white/70">
              {rank.xp} / {rank.nextXp} XP до «{rank.nextTitle}»
            </span>
          )}
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.round(rank.progress * 100)}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
          <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="6" />
          <circle
            cx="28"
            cy="28"
            r={RADIUS}
            fill="none"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 28 28)"
            className="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
        <div>
          <p className="font-semibold">
            {current} / {goal} слов
          </p>
          <p className="text-sm text-white/80">дневная цель</p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-white/15 px-3 py-2 text-sm">
        <span>🔥 {streak} дней</span>
        <span>📇 {dueCount} к повтору</span>
        <span>＋{newWordsToday} новых</span>
      </div>

      {continueReading && (
        <Link
          href={`/read/${continueReading.textId}`}
          className="block rounded-xl bg-white/15 px-3 py-2.5"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">
            Продолжить чтение
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold">{continueReading.title}</p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${continueReading.percentRead}%` }} />
          </div>
        </Link>
      )}

      {dueCount > 0 && (
        <Link
          href="/brain/all/review"
          className="block rounded-full bg-black/85 py-2.5 text-center text-sm font-semibold text-white"
        >
          Начать повторение
        </Link>
      )}
    </div>
  );
}
