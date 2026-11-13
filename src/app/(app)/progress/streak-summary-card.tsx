import { Flame } from "lucide-react";

// docs/moments/mockups/Progress.dc.html, docs/moments/ROADMAP.md этап 8 —
// оранжевая карточка стрика с запасом заморозок, заменяет прежний
// StreakHero в верхней части /progress.
export default function StreakSummaryCard({
  days,
  bestStreak,
  freezeAvailable,
}: {
  days: number;
  bestStreak: number;
  /** profiles.streak_freeze_available хранит только да/нет, не число — схема
   *  не даёт честного количества заморозок, поэтому подпись не выдумывает
   *  цифру из Progress.dc.html ("1 заморозка"). */
  freezeAvailable: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3.5 rounded-2xl border-2 p-3.5"
      style={{ background: "var(--ember-tint)", borderColor: "var(--ember)" }}
    >
      <Flame aria-hidden="true" className="h-10 w-10 shrink-0" style={{ color: "var(--ember)" }} />
      <div>
        <p className="font-display text-xl font-extrabold" style={{ color: "var(--ember-text)" }}>
          {days} {days === 1 ? "день" : "дней"}
        </p>
        <p className="text-sm" style={{ color: "var(--ember-text)" }}>
          Рекорд {bestStreak}
          {freezeAvailable ? " · заморозка в запасе" : " · нет запасной заморозки"}
        </p>
      </div>
    </div>
  );
}
