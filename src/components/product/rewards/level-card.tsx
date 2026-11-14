import { Flame, Trophy, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { levelProgress } from "@/lib/level";
import { rankForXp } from "@/lib/ranks";
import { pluralRu } from "@/lib/plural-ru";

// Верх экрана наград: весь XP, уровень (level.ts — 100 XP на уровень, формула одна
// на приложение), звание (ranks.ts — подпись) и три коротких показателя.
export function LevelCard({
  xp,
  streak,
  achievementsEarned,
  achievementsTotal,
}: {
  xp: number;
  streak: number;
  achievementsEarned: number;
  achievementsTotal: number;
}) {
  const level = levelProgress(xp);
  const rank = rankForXp(xp);
  const toNext = level.xpForNextLevel - level.xpIntoLevel;
  return (
    <Card as="section" aria-labelledby="rewards-xp-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="rewards-xp-title" className="text-caption font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            Опыт
          </h2>
          <p className="text-h1 m-0 flex items-baseline gap-2 tabular-nums">
            {xp.toLocaleString("ru-RU")}
            <span className="text-body-sm font-semibold text-[var(--sun-text)]">XP</span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-h2 m-0">Уровень {level.level}</p>
          <p className="text-caption m-0 text-[var(--text-secondary)]">{rank.title}</p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Progress value={level.progress} tone="sun" label={`Уровень ${level.level}: ${level.xpIntoLevel} из ${level.xpForNextLevel} XP`} />
        <p className="text-caption m-0 text-[var(--text-secondary)]">
          Ещё {toNext} XP до уровня {level.level + 1}
        </p>
      </div>

      <dl className="m-0 grid grid-cols-3 gap-2">
        <Stat icon={<Zap aria-hidden="true" className="h-4 w-4 text-[var(--sun-text)]" />} label="Уровень" value={String(level.level)} />
        <Stat
          icon={<Flame aria-hidden="true" className="h-4 w-4 text-[var(--ember-text)]" />}
          label={pluralRu(streak, "день подряд", "дня подряд", "дней подряд")}
          value={String(streak)}
        />
        <Stat
          icon={<Trophy aria-hidden="true" className="h-4 w-4 text-[var(--sky-text)]" />}
          label="достижений"
          value={`${achievementsEarned}/${achievementsTotal}`}
        />
      </dl>
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] px-3 py-2">
      <dt className="text-caption flex items-center gap-1.5 text-[var(--text-secondary)]">
        {icon}
        {label}
      </dt>
      <dd className="text-h2 m-0 tabular-nums">{value}</dd>
    </div>
  );
}
