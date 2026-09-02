import { Flame } from "lucide-react";

// feat/hybrid-gamification-visuals: стрик раньше сидел рядовой плиткой в
// сетке "Показатели" — та же карточка, тот же размер, что и "Материалов
// завершено". Стрик — самая эмоционально нагруженная метрика на экране
// (GitHub/Duolingo и так далее строят вокруг неё отдельный герой-блок не
// просто так), поэтому вынесен отдельно и крупнее. Тёплый оранжевый —
// единственное намеренное отступление от единого forest-акцента:
// семантический цвет огня/стрика, не декоративный — используем уже
// существующий --color-warning (а не сырой Tailwind amber/orange), чтобы
// не заводить второй "оранжевый" в дизайн-системе рядом с уже имеющимся.
export default function StreakHero({ days }: { days: number }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card p-5 shadow-sm">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning)]/15 text-[var(--color-warning)]">
        <Flame aria-hidden="true" className="h-9 w-9" fill="currentColor" />
      </div>
      <div>
        <p className="text-4xl font-bold text-[var(--color-warning)]">{days}</p>
        <p className="text-sm text-[var(--text-secondary)]">{days === 1 ? "день подряд" : "дней подряд"}</p>
      </div>
    </div>
  );
}
