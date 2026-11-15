import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES, type AchievementView } from "@/lib/achievements";
import { dayLabel } from "@/lib/rewards/history";

const ICONS = new Map(ACHIEVEMENTS.map((a) => [a.id, a.icon]));

// Достижения по категориям: название, условие, статус (получено + дата / в процессе
// с прогрессом / закрыто). Статус — текстом и иконкой, не только цветом/прозрачностью.
export function AchievementsGrid({ views, today }: { views: AchievementView[]; today: string }) {
  const earned = views.filter((v) => v.status === "earned").length;
  return (
    <Card as="section" aria-labelledby="rewards-ach-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="rewards-ach-title" className="text-h2 m-0">
          Достижения
        </h2>
        <span className="text-caption tabular-nums text-[var(--text-secondary)]">
          {earned} из {views.length}
        </span>
      </div>

      {ACHIEVEMENT_CATEGORIES.map((category) => {
        const items = views.filter((v) => v.category === category.id);
        if (items.length === 0) return null;
        return (
          <div key={category.id} className="flex flex-col gap-2">
            <h3 className="text-body-sm m-0 font-semibold text-[var(--text-secondary)]">{category.title}</h3>
            <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
              {items.map((view) => {
                const Icon = ICONS.get(view.id);
                const isEarned = view.status === "earned";
                return (
                  <li
                    key={view.id}
                    data-status={view.status}
                    className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                        isEarned ? "bg-[var(--sky)] text-white" : "bg-[var(--surface-muted)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {Icon && isEarned ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-sm m-0 font-semibold">{view.title}</p>
                      <p className="text-caption m-0 text-[var(--text-secondary)]">{view.description}</p>
                      {isEarned ? (
                        <p className="text-caption m-0 mt-1 font-semibold text-[var(--leaf-text)]">
                          Получено{view.earnedAt ? ` · ${dayLabel(view.earnedAt.slice(0, 10), today)}` : ""}
                        </p>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress
                            className="flex-1"
                            size="sm"
                            value={view.progress.ratio}
                            tone="sky"
                            label={`${view.title}: ${view.progress.current} из ${view.progress.target}`}
                          />
                          <span className="text-caption tabular-nums text-[var(--text-secondary)]">
                            {view.progress.current}/{view.progress.target}
                          </span>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </Card>
  );
}
