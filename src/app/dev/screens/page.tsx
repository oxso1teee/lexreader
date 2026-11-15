import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/product/app-shell/app-shell";
import DashboardView, { type DashboardViewProps } from "@/components/product/dashboard/dashboard-view";
import TodayEveningView from "@/components/product/today/v7/today-evening";
import MobileBottomNav from "@/components/product/app-shell/mobile-bottom-nav";
import { DailyQuestsCard } from "@/components/product/quests/daily-quests-card";
import { RewardsSummaryCard } from "@/components/product/dashboard/rewards-summary-card";
import { buildQuestItems } from "@/lib/daily-quests";
import {
  DASHBOARD_EMPTY_FIXTURE,
  DASHBOARD_FIRST_DAY_FIXTURE,
  DASHBOARD_GOAL_DONE_FIXTURE,
  DASHBOARD_REGULAR_FIXTURE,
  TODAY_EVENING_FIXTURE,
} from "@/lib/screen-fixtures";
import { LessonGalleryScreen } from "./lesson-gallery";
import RewardsGalleryScreen from "./rewards-gallery";
import { REWARDS_SCREENS, isRewardsScreen } from "./rewards-screens";
import { LESSON_SCREENS, isLessonScreen } from "./lesson-screens";
import { PATH_SCREENS, PathGalleryScreen, isPathScreen } from "./path-gallery";
import { Stage3GalleryScreen } from "./stage3-gallery";
import { Stage6GalleryScreen } from "./stage6-gallery";
import { Stage7GalleryScreen } from "./stage7-gallery";
import { Stage9GalleryScreen } from "./stage9-gallery";
import { StreakCalendarView } from "@/app/(app)/streak/streak-calendar-view";
import ProgressOverview from "@/app/(app)/progress/progress-overview";

// Список здесь, а не в stage9-gallery.tsx: константа из "use client"-модуля
// на сервере — клиентская ссылка, а не массив.
const STAGE9_SCREENS = [
  "Lesson-build",
  "Lesson-listen",
  "Result",
  "Combo",
  "Daily-quests",
  "Chest",
  "Double-XP",
  "Placement-result",
  "Goal-pick",
  "Streak-commit",
  "First-text",
] as const;

// Октябрь 2026: занятия 1–19, кроме 5 (заморозка), сегодня — 19-е.
const STREAK_CALENDAR_FIXTURE = {
  monthStart: new Date(Date.UTC(2026, 9, 1)),
  todayIso: "2026-10-19",
  isCurrentMonth: true,
  rows: Array.from({ length: 19 }, (_, i) => {
    const d = i + 1;
    return { day: `2026-10-${String(d).padStart(2, "0")}`, xp: d === 5 ? 0 : 20, freeze_used: d === 5 };
  }),
  streakCurrent: 13,
  streakLongest: 21,
  streakGoalDays: null,
  freezeUsedThisWeek: false,
};

// Основные экраны v7 с тестовыми данными — для скриншот-сверки с макетами
// (docs/moments/reference). Открыта локально и на preview-деплоях.
export const metadata = { robots: { index: false, follow: false } };

// Главный экран «Сегодня» в четырёх состояниях и тот же DashboardView, что на
// /home, внутри настоящей оболочки (сайдбар от md, таббар на телефоне) — так
// ширина контейнера и раскладка совпадают с боевой страницей.
function dashboardFixtureFor(s: string | undefined): DashboardViewProps | null {
  switch (s) {
    case "Main":
      return DASHBOARD_REGULAR_FIXTURE;
    case "Today-new":
      return DASHBOARD_FIRST_DAY_FIXTURE;
    case "Today-done":
      return DASHBOARD_GOAL_DONE_FIXTURE;
    case "Today-empty":
      return DASHBOARD_EMPTY_FIXTURE;
    default:
      return null;
  }
}

// Три задания дня, как на макете Daily-quests: два выполнены, одно в процессе.
const QUESTS_CARD = (
  <DailyQuestsCard
    items={buildQuestItems(
      [
        { questType: "read_minutes", target: 10 },
        { questType: "review_words", target: 15 },
        { questType: "combo_streak", target: 5 },
      ],
      { read_minutes: 10, review_words: 15, combo_streak: 2, earn_xp: 0, complete_lessons: 0, answer_exercises: 0 },
      { day: "2026-11-14", today: "2026-11-14", claimed: false },
    )}
    allComplete={false}
    chestClaimedToday={false}
  />
);

const SCREENS = [
  "Main",
  "Today-new",
  "Today-done",
  "Today-empty",
  "Today-evening",
  "Lesson-start",
  "Halfway",
  "Mistakes",
  "Quit-confirm",
  "Lesson-choice",
  "Duel-invite",
  "Duel-won",
  "Splash",
  "Offline",
  ...PATH_SCREENS,
  ...LESSON_SCREENS,
  ...REWARDS_SCREENS,
  ...STAGE9_SCREENS,
  "Streak-calendar",
  "Progress",
] as const;

// 5 недель активности с разной интенсивностью, сегодня — пусто.
function progressCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  const pattern = [0, 2, 5, 1, 0, 0, 3, 6, 4, 9, 1, 0, 2, 8, 1, 7, 8, 4, 3, 0, 1, 6, 3, 9, 7, 2, 1, 4, 9, 8, 4];
  const today = new Date();
  pattern.forEach((n, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (pattern.length - i)));
    out[d.toISOString().slice(0, 10)] = n;
  });
  return out;
}

export default async function DevScreensPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const isLiveSite = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (isLiveSite && process.env.MOMENTS_GALLERY !== "1") notFound();
  const { s } = await searchParams;

  const dashboard = dashboardFixtureFor(s);
  if (dashboard) {
    return (
      <AppShell planLabel={null}>
        <DashboardView
          {...dashboard}
          questsCard={s === "Today-empty" ? null : QUESTS_CARD}
          rewardsCard={<RewardsSummaryCard xp={dashboard.xp} recent={s === "Today-new" || s === "Today-empty" ? [] : [{ id: "streak_7", earnedAt: "2026-11-12T10:00:00Z" }, { id: "first_book", earnedAt: "2026-11-09T10:00:00Z" }]} />}
        />
      </AppShell>
    );
  }

  if (s === "Today-evening") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="flex flex-1 flex-col">
          <TodayEveningView {...TODAY_EVENING_FIXTURE} />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  if (s === "Lesson-start" || s === "Halfway" || s === "Mistakes" || s === "Quit-confirm" || s === "Lesson-choice") {
    return <Stage3GalleryScreen s={s} />;
  }

  if (s === "Duel-invite" || s === "Duel-won") {
    return <Stage6GalleryScreen s={s} />;
  }

  if (s === "Progress") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 pb-28">
          <ProgressOverview
            period="7"
            streakCurrent={12}
            streakLongest={21}
            freezeAvailable
            knownWords={842}
            finishedTexts={37}
            weeklyXp={310}
            reviewsThisWeek={96}
            activityCounts={progressCounts()}
            myRank={4}
            duel={{ myScore: 3, opponentScore: 2, opponentInitials: "А" }}
          />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  if (s === "Streak-calendar") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="flex flex-1 flex-col">
          <StreakCalendarView {...STREAK_CALENDAR_FIXTURE} />
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  if (s && (STAGE9_SCREENS as readonly string[]).includes(s)) {
    return <Stage9GalleryScreen s={s} />;
  }

  if (s === "Splash" || s === "Offline") {
    return <Stage7GalleryScreen s={s} />;
  }

  if (isPathScreen(s)) {
    return <PathGalleryScreen s={s} />;
  }

  // Плеер уроков (итерация 5) — внутри настоящей оболочки, как на боевой странице.
  if (isLessonScreen(s)) {
    return (
      <AppShell planLabel={null}>
        <LessonGalleryScreen s={s} />
      </AppShell>
    );
  }

  // Экран наград (итерация 6) — внутри настоящей оболочки.
  if (isRewardsScreen(s)) {
    return (
      <AppShell planLabel={null}>
        <RewardsGalleryScreen s={s} />
      </AppShell>
    );
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-3 p-6">
      <h1 className="font-display text-2xl font-bold">Основные экраны</h1>
      <Link href="/dev/moments" className="text-sm underline">Всплывающие экраны →</Link>
      {SCREENS.map((n) => (
        <Link key={n} href={`/dev/screens?s=${n}`} className="btn btn-ghost btn-md justify-start">
          {n}
        </Link>
      ))}
    </main>
  );
}
