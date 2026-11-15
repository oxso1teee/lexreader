import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS } from "@/lib/achievements";
import type { RecentAchievement } from "@/lib/rewards/achievements-view";
import { levelProgress } from "@/lib/level";
import { rankForXp } from "@/lib/ranks";

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// Награды на главном экране: уровень и прогресс до следующего, последние полученные
// достижения и вход на /rewards (полная картина: цель, задания, история XP).
export function RewardsSummaryCard({ xp, recent }: { xp: number; recent: RecentAchievement[] }) {
  const level = levelProgress(xp);
  const rank = rankForXp(xp);
  const shown = recent.map((r) => BY_ID.get(r.id)).filter((a): a is NonNullable<typeof a> => Boolean(a));
  return (
    <Card as="section" aria-labelledby="dash-rewards-title" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 id="dash-rewards-title" className="text-h2 m-0 flex items-center gap-2">
          <Trophy aria-hidden="true" className="h-5 w-5 text-[var(--sun-text)]" />
          Награды
        </h2>
        <Link href="/rewards" className="focus-ring text-body-sm inline-flex items-center gap-0.5 font-semibold text-[var(--sky-text)]">
          Все
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-body-sm flex items-baseline justify-between gap-2">
          <span className="font-semibold">
            Уровень {level.level} · {rank.title}
          </span>
          <span className="tabular-nums text-[var(--text-secondary)]">{xp.toLocaleString("ru-RU")} XP</span>
        </div>
        <Progress value={level.progress} tone="sun" size="sm" label={`Уровень ${level.level}: ${level.xpIntoLevel} из ${level.xpForNextLevel} XP`} />
      </div>

      {shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {shown.map((a) => (
            <li key={a.id} className="text-body-sm flex items-center gap-2">
              <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sky)] text-white">
                <a.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 truncate">{a.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption m-0 text-[var(--text-secondary)]">Достижений пока нет — первое уже близко.</p>
      )}
    </Card>
  );
}
