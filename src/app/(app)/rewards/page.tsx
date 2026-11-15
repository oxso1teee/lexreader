import { unstable_rethrow } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/product/page-header";
import { Alert } from "@/components/ui/alert";
import { AchievementsGrid } from "@/components/product/rewards/achievements-grid";
import { GoalCard } from "@/components/product/rewards/goal-card";
import { LevelCard } from "@/components/product/rewards/level-card";
import { QuestsBoard } from "@/components/product/rewards/quests-board";
import { XpHistory } from "@/components/product/rewards/xp-history";
import { getDailyQuestsSnapshot, getRecentQuestDays } from "@/lib/daily-quests";
import { goalProgressFor } from "@/lib/dashboard/goal";
import { streakDisplay } from "@/lib/dashboard/streak";
import { EMPTY_ACTIVITY, loadDailyActivity, type DailyActivity } from "@/lib/goals/activity";
import { NO_PENDING_XP, loadPendingXp } from "@/lib/xp/rollout";
import { resolveGoalConfig } from "@/lib/goals/config";
import { log } from "@/lib/log";
import { loadAchievementViews } from "@/lib/rewards/achievements-view";
import { loadXpHistory } from "@/lib/rewards/history";
import { userClock } from "@/lib/user-day";

export const metadata = { title: "Награды" };

// /rewards — одно место для всей системы мотивации: XP и уровень → цель дня →
// задания и сундук → достижения → история начислений. Данные — только из реальных
// таблиц (activity_days, xp_events, daily_quests, user_achievements); день — по
// часовому поясу пользователя. Необязательный блок, который не загрузился, не роняет
// страницу: остальные показываются, сверху — предупреждение.
export default async function RewardsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const clock = userClock(profile.timezone);

  const failed: string[] = [];
  async function settled<T>(label: string, promise: PromiseLike<T>, fallback: T): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      unstable_rethrow(error);
      failed.push(label);
      log.error({ kind: "rewards_block", message: `${label}: ${error instanceof Error ? error.message : "unknown"}` });
      return fallback;
    }
  }

  const activity = await settled<DailyActivity | null>(
    "Прогресс за день",
    loadDailyActivity(supabase, profile.id, profile.target_language, clock.today, clock.timezone),
    null,
  );
  const [pendingXp, snapshot, pastQuests, history, achievements] = await Promise.all([
    // Общий XP с поправкой на события, ещё не перенесённые в счётчик (только пока идёт выкладка).
    settled("XP в журнале", loadPendingXp(supabase, profile.id), NO_PENDING_XP),
    activity
      ? settled("Задания дня", getDailyQuestsSnapshot(supabase, profile.id, profile.target_language, { clock, activity }), null)
      : Promise.resolve(null),
    settled("Прошлые задания", getRecentQuestDays(supabase, profile.id, profile.target_language, clock), []),
    settled("История XP", loadXpHistory(supabase, profile.id), []),
    settled("Достижения", loadAchievementViews(supabase, profile.id, profile.target_language), []),
  ]);

  const goal = goalProgressFor(resolveGoalConfig(profile), activity ?? { ...EMPTY_ACTIVITY }, profile.daily_xp_goal);
  const streak = streakDisplay(
    {
      streakCurrent: profile.streak_current,
      lastActiveDate: profile.last_active_date,
      freezeAvailable: profile.streak_freeze_available,
      freezeWeek: profile.streak_freeze_week,
    },
    clock.wall,
  );

  return (
    <div className="page-content flex flex-col gap-4">
      <PageHeader title="Награды" description="Опыт, цель дня, задания и достижения — всё, что ты заработал." />

      {failed.length > 0 && (
        <Alert tone="warning" title="Часть данных не загрузилась" live="polite">
          {failed.join(", ")}. Обнови страницу — остальное ниже актуально.
        </Alert>
      )}

      <LevelCard
        xp={profile.xp + pendingXp.total}
        streak={streak.value}
        achievementsEarned={achievements.filter((a) => a.status === "earned").length}
        achievementsTotal={achievements.length}
      />

      <div className="split-main-aside items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <GoalCard goal={goal} />
          {snapshot ? (
            <QuestsBoard
              items={snapshot.items}
              allComplete={snapshot.allComplete}
              chestClaimed={snapshot.chestClaimedToday}
              today={clock.today}
              past={pastQuests}
            />
          ) : null}
          {achievements.length > 0 ? <AchievementsGrid views={achievements} today={clock.today} /> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <XpHistory days={history} today={clock.today} />
        </div>
      </div>
    </div>
  );
}
