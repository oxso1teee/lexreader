import Link from "next/link";
import { notFound } from "next/navigation";
import TodayView from "@/components/product/today/v7/today-view";
import TodayEveningView from "@/components/product/today/v7/today-evening";
import MobileBottomNav from "@/components/product/app-shell/mobile-bottom-nav";
import { TODAY_FIXTURE, TODAY_EVENING_FIXTURE } from "@/lib/screen-fixtures";
import { Stage3GalleryScreen } from "./stage3-gallery";
import { Stage6GalleryScreen } from "./stage6-gallery";
import { Stage7GalleryScreen } from "./stage7-gallery";
import { Stage9GalleryScreen } from "./stage9-gallery";
import { StreakCalendarView } from "@/app/(app)/streak/streak-calendar-view";
import PathMap, { PathHeader } from "@/app/(app)/learning-paths/path-map";
import { getPath } from "@/lib/learning-paths/curriculum/index.ts";
import type { ActivePathState } from "@/app/(app)/learning-paths/actions";

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

// Путь "everyday": первые два навыка первого этапа пройдены, третий — текущий.
function pathFixture(): ActivePathState | null {
  const path = getPath("everyday");
  if (!path) return null;
  const stage = path.stages[0];
  const skills = stage.modules.flatMap((m) => m.skills);
  const now = new Date().toISOString();
  const progressRows = skills.slice(0, 2).map((sk, i) => ({
    id: `fx-${i}`,
    user_id: "fx",
    path_slug: path.slug,
    path_version: path.version,
    skill_key: sk.key,
    status: "improving" as const,
    evidence_count: 3,
    confidence: "medium" as const,
    content_completed_at: now,
    last_practiced_at: now,
    knowledge_check_best_score: null,
    created_at: now,
    updated_at: now,
  }));
  return {
    enrollment: {} as ActivePathState["enrollment"],
    path,
    progressRows,
    contentProgressPercent: 0,
    skillsConfident: 0,
    skillsImproving: 2,
    currentStage: stage,
    focusSkill: skills[2] ?? null,
  };
}

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

const SCREENS = [
  "Main",
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
  ...STAGE9_SCREENS,
  "Streak-calendar",
  "Path",
] as const;

export default async function DevScreensPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const isLiveSite = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview";
  if (isLiveSite && process.env.MOMENTS_GALLERY !== "1") notFound();
  const { s } = await searchParams;

  if (s === "Main") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="flex flex-1 flex-col">
          <TodayView {...TODAY_FIXTURE} />
        </main>
        <MobileBottomNav />
      </div>
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

  if (s === "Path") {
    const state = pathFixture();
    if (!state) notFound();
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
          <PathHeader title={state.path.title} levelFrom={state.path.levelFrom} levelTo={state.path.levelTo} />
          <PathMap state={state} pathSlug={state.path.slug} />
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
