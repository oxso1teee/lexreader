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
      className="flex items-center gap-3.5 rounded-[20px] border-2 px-4 py-4"
      style={{ background: "var(--ember-tint)", borderColor: "var(--ember)" }}
    >
      <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true" className="shrink-0">
        <path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-7 0 2 1 3 2 3 0-3-1-5 1-8z" fill="var(--ember)" />
        <path d="M12 12c.6 2 3 3 3 5.5a3 3 0 0 1-6 0c0-1.5 1-2.5 1.5-3.5.2 1 .7 1.5 1.2 1.5 0-1.5-.4-2.5.3-3.5z" fill="var(--sun)" />
      </svg>
      <div>
        <p className="mo-disp text-[22px] font-black leading-tight" style={{ color: "var(--ember-text)" }}>
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
