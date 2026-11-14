import PageHeader from "@/components/product/page-header";
import { AchievementsGrid } from "@/components/product/rewards/achievements-grid";
import { GoalCard } from "@/components/product/rewards/goal-card";
import { LevelCard } from "@/components/product/rewards/level-card";
import { QuestsBoard } from "@/components/product/rewards/quests-board";
import { XpHistory } from "@/components/product/rewards/xp-history";
import { Alert } from "@/components/ui/alert";
import { LoadingState } from "@/components/ui/states";
import { buildAchievementViews, type AchievementStats } from "@/lib/achievements";
import { buildQuestItems, type DailyQuestDef, type DailyQuestProgress } from "@/lib/daily-quests";
import { goalProgressFor } from "@/lib/dashboard/goal";
import { groupXpHistory, toHistoryEvent } from "@/lib/rewards/history";
import type { RewardsScreen } from "./rewards-screens";

// Экран наград на галерее: те же компоненты, что и на /rewards, на фикстурах —
// без Supabase и логина. Покрывает состояния: обычный день, новый пользователь
// (пусто), всё выполнено и сундук ждёт, сундук забран, редактор цели, частичный
// сбой загрузки и скелет.

const TODAY = "2026-11-14";
const DEFS: DailyQuestDef[] = [
  { questType: "read_minutes", target: 10 },
  { questType: "review_words", target: 15 },
  { questType: "complete_lessons", target: 2 },
];
const ZERO_PROGRESS: DailyQuestProgress = { read_minutes: 0, review_words: 0, combo_streak: 0, earn_xp: 0, complete_lessons: 0, answer_exercises: 0 };

const ZERO_STATS: AchievementStats = {
  totalWords: 0, finishedTexts: 0, bestStreak: 0, bestSessionCount: 0, lessons: 0, reviewsTotal: 0, goalDays: 0, perfectWeeks: 0, chests: 0, totalXp: 0,
};

const EVENTS = [
  { id: "e1", source: "lesson_complete", amount: 20, boosted: false, day: TODAY, created_at: "2026-11-14T10:20:00Z" },
  { id: "e2", source: "review_card", amount: 2, boosted: true, day: TODAY, created_at: "2026-11-14T09:40:00Z" },
  { id: "e3", source: "reading_session", amount: 10, boosted: false, day: TODAY, created_at: "2026-11-14T08:10:00Z" },
  { id: "e4", source: "quest_chest", amount: 30, boosted: false, day: "2026-11-13", created_at: "2026-11-13T19:00:00Z" },
  { id: "e5", source: "perfect_session", amount: 10, boosted: false, day: "2026-11-13", created_at: "2026-11-13T18:00:00Z" },
  { id: "e6", source: "word_saved", amount: 2, boosted: false, day: "2026-11-01", created_at: "2026-11-01T12:00:00Z" },
].map(toHistoryEvent);

function earned(...ids: string[]): Map<string, string> {
  return new Map(ids.map((id, i) => [id, `2026-11-${String(10 + i).padStart(2, "0")}T09:00:00Z`]));
}

export default function RewardsGalleryScreen({ s }: { s: RewardsScreen }) {
  if (s === "Rewards-loading") {
    return (
      <div className="page-content flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="h-8 w-32 animate-pulse rounded bg-[var(--surface-muted)]" />
          <div className="h-4 w-64 max-w-full animate-pulse rounded bg-[var(--surface-muted)]" />
        </div>
        <LoadingState rows={4} label="Загрузка наград" />
      </div>
    );
  }

  const fresh = s === "Rewards-new";
  const done = s === "Rewards-done" || s === "Rewards-claimed";
  const claimed = s === "Rewards-claimed";
  const goalEdit = s === "Rewards-goal-edit";
  const failed = s === "Rewards-error";

  const xp = fresh ? 0 : done ? 245 : 168;
  const goal = fresh
    ? goalProgressFor({ type: "xp", target: 50 }, { xp: 0, readingMinutes: 0, reviewedWords: 0, lessons: 0, exercises: 0 }, 50)
    : goalEdit
      ? goalProgressFor({ type: "lessons", target: 2 }, { xp: 35, readingMinutes: 6, reviewedWords: 9, lessons: 1, exercises: 7 }, 50)
      : done
        ? goalProgressFor({ type: "xp", target: 50 }, { xp: 62, readingMinutes: 12, reviewedWords: 18, lessons: 2, exercises: 14 }, 50)
        : goalProgressFor({ type: "xp", target: 50 }, { xp: 35, readingMinutes: 6, reviewedWords: 9, lessons: 1, exercises: 7 }, 50);

  const progress: DailyQuestProgress = fresh
    ? ZERO_PROGRESS
    : done
      ? { ...ZERO_PROGRESS, read_minutes: 12, review_words: 18, complete_lessons: 2 }
      : { ...ZERO_PROGRESS, read_minutes: 10, review_words: 6, complete_lessons: 0 };
  const items = buildQuestItems(DEFS, progress, { day: TODAY, today: TODAY, claimed });
  const allComplete = items.every((i) => i.done);

  const past = fresh
    ? []
    : [
        { day: "2026-11-13", claimed: true, items: buildQuestItems(DEFS, { ...ZERO_PROGRESS, read_minutes: 12, review_words: 20, complete_lessons: 2 }, { day: "2026-11-13", today: TODAY, claimed: true }) },
        { day: "2026-11-12", claimed: false, items: buildQuestItems(DEFS, { ...ZERO_PROGRESS, read_minutes: 4 }, { day: "2026-11-12", today: TODAY, claimed: false }) },
      ];

  const achievementViews = fresh
    ? buildAchievementViews(ZERO_STATS, new Map())
    : buildAchievementViews(
        { ...ZERO_STATS, totalWords: 64, finishedTexts: 2, bestStreak: 12, lessons: 3, reviewsTotal: 140, goalDays: 5, totalXp: xp, chests: claimed ? 1 : 0 },
        earned("first_lesson", "first_book", "words_10", "streak_3", "streak_7", "xp_100", "reviews_100"),
      );

  return (
    <div className="page-content flex flex-col gap-4">
      <PageHeader title="Награды" description="Опыт, цель дня, задания и достижения — всё, что ты заработал." />

      {failed && (
        <Alert tone="warning" title="Часть данных не загрузилась" live="polite">
          История XP, Достижения. Обнови страницу — остальное ниже актуально.
        </Alert>
      )}

      <LevelCard
        xp={xp}
        streak={fresh ? 0 : 12}
        achievementsEarned={achievementViews.filter((a) => a.status === "earned").length}
        achievementsTotal={achievementViews.length}
      />

      <div className="split-main-aside items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <GoalCard goal={goal} defaultEditing={goalEdit} />
          <QuestsBoard items={items} allComplete={allComplete} chestClaimed={claimed} today={TODAY} past={past} />
          {!failed && <AchievementsGrid views={achievementViews} today={TODAY} />}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <XpHistory days={fresh || failed ? [] : groupXpHistory(EVENTS)} today={TODAY} />
        </div>
      </div>
    </div>
  );
}
