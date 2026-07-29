import { ACHIEVEMENTS, WEEKLY_QUEST_TARGET } from "@/lib/achievements";

export default function AchievementsShelf({
  earnedIds,
  weeklyQuestProgress,
  streakFreezeAvailable,
}: {
  earnedIds: Set<string>;
  weeklyQuestProgress: number;
  streakFreezeAvailable: boolean;
}) {
  const questRatio = Math.min(1, weeklyQuestProgress / WEEKLY_QUEST_TARGET);

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="mb-3 font-semibold">Достижения</h2>

      <div className="flex flex-wrap gap-2.5">
        {ACHIEVEMENTS.map((a) => {
          const earned = earnedIds.has(a.id);
          return (
            <div
              key={a.id}
              title={`${a.title} — ${a.description}`}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-black/5 text-2xl dark:bg-white/10 ${
                earned ? "" : "opacity-30 grayscale"
              }`}
            >
              {a.icon}
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg bg-black/5 p-3 dark:bg-white/10">
        <p className="mb-1 text-sm font-medium">Квест недели: добавь {WEEKLY_QUEST_TARGET} новых слов</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
          <div className="h-full rounded-full bg-caramel" style={{ width: `${questRatio * 100}%` }} />
        </div>
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          {weeklyQuestProgress} / {WEEKLY_QUEST_TARGET}
        </p>
      </div>

      <div className="mt-2 flex items-center gap-2 rounded-lg bg-black/5 p-3 text-sm dark:bg-white/10">
        <span>❄️</span>
        <span>
          {streakFreezeAvailable
            ? "Заморозка стрика доступна — пропуск одного дня на этой неделе не обнулит серию"
            : "Заморозка уже использована на этой неделе"}
        </span>
      </div>
    </div>
  );
}
