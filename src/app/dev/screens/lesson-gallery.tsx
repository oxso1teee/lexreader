"use client";

import dynamic from "next/dynamic";
import LessonComplete from "@/components/product/lessons/lesson-complete";
import LessonHeader from "@/components/product/lessons/lesson-header";
import LessonStartCard from "@/components/product/lessons/lesson-start-card";
import { PlayerFatal, PlayerLoading } from "@/components/product/lessons/player-states";
import type { LessonCompletionDto } from "@/lib/lessons/dto";
import type { LessonOverview } from "@/lib/lessons/server";
import { isPlayerScreen, type LessonScreen, type StaticLessonScreen } from "./lesson-screens";

// Плеер уроков на галерее (Phase 2, итерация 5): без Supabase и логина.
//
// Статичные экраны — те же компоненты плеера на фикстурах. Интерактивные (Player-*)
// живут в player-stand.tsx и подключаются только вне production-сборки: стенд
// содержит настоящий сервис с банком ответов, и в публичные чанки попадать не должен.
// В `next dev` (так гоняются e2e-ui тесты) он работает; в production-сборке и на
// preview-деплоях доступны только статичные состояния.
const PlayerStand = process.env.NODE_ENV === "production" ? null : dynamic(() => import("./player-stand"));

// ---------- статичные состояния ----------

const COMPLETION_BASE: LessonCompletionDto = {
  attemptId: "fixture",
  pathSlug: "a2-b1",
  skillKey: "grammar.present_simple",
  mode: "lesson",
  finalizedNow: true,
  passed: true,
  scoreRatio: 0.857,
  bucket: "strong",
  correctCount: 6,
  incorrectCount: 1,
  xpAwarded: 15,
  xpAlreadyEarned: true,
  xpPending: false,
  lessonCompleted: true,
  firstWin: false,
  moments: [],
  path: { percent: 11, doneLessons: 2, totalLessons: 18, complete: false, unitTitle: "Основы предложения", unitDone: false },
  nextLesson: { skillKey: "grammar.present_continuous", unitKey: "core-sentence-building", title: "Present Continuous" },
};

const COMPLETION_FIXTURES: Record<string, LessonCompletionDto> = {
  "Complete-passed": COMPLETION_BASE,
  "Complete-perfect": { ...COMPLETION_BASE, scoreRatio: 1, correctCount: 7, incorrectCount: 0, xpAwarded: 20 },
  "Complete-failed": {
    ...COMPLETION_BASE,
    passed: false,
    scoreRatio: 0.286,
    bucket: "weak",
    correctCount: 2,
    incorrectCount: 5,
    xpAwarded: 0,
    xpAlreadyEarned: false,
    lessonCompleted: false,
    nextLesson: null,
  },
  "Complete-check-failed": {
    ...COMPLETION_BASE,
    mode: "check",
    passed: false,
    scoreRatio: 0.6,
    bucket: "mixed",
    correctCount: 3,
    incorrectCount: 2,
    xpAwarded: 0,
    xpAlreadyEarned: false,
    lessonCompleted: false,
    nextLesson: null,
  },
  "Complete-first-win": { ...COMPLETION_BASE, firstWin: true, xpAlreadyEarned: false },
  "Complete-xp-pending": { ...COMPLETION_BASE, xpAwarded: 0, xpAlreadyEarned: false, xpPending: true },
};

const OVERVIEW_BASE: LessonOverview = { stepCount: 10, exerciseCount: 7, hasCheck: true, open: null, last: null, xpEarned: false };
const OVERVIEWS: Record<string, { overview: LessonOverview; completed: boolean }> = {
  "Start-card-new": { overview: OVERVIEW_BASE, completed: false },
  "Start-card-resume": { overview: { ...OVERVIEW_BASE, open: { stepIndex: 4, stepsTotal: 10 } }, completed: false },
  "Start-card-done": {
    overview: { ...OVERVIEW_BASE, xpEarned: true, last: { passed: true, correctCount: 6, incorrectCount: 1, mode: "lesson" } },
    completed: true,
  },
};

function StaticScreen({ screen }: { screen: StaticLessonScreen }) {
  const noop = () => {};
  if (screen === "Player-loading") {
    return (
      <div className="lp page-content">
        <h1 className="sr-only">Плеер урока — загрузка</h1>
        <PlayerLoading />
      </div>
    );
  }
  if (screen === "Player-fatal" || screen === "Player-fatal-auth") {
    const auth = screen === "Player-fatal-auth";
    return (
      <div className="lp page-content">
        <PlayerFatal
          error={
            auth
              ? { code: "unauthorized", message: "Сессия закончилась. Войди снова — прогресс урока сохранён.", retryable: false }
              : { code: "storage_failed", message: "Не удалось сохранить прогресс. Проверь соединение и повтори.", retryable: true }
          }
          onRetry={noop}
          backHref="/dev/screens?s=Lesson-current"
          loginHref="/login"
        />
      </div>
    );
  }
  const overview = OVERVIEWS[screen];
  if (overview) {
    return (
      <div className="lp page-content">
        <h1 className="lp-hero-title">Present Simple</h1>
        <LessonStartCard overview={overview.overview} completed={overview.completed} playUrl="/dev/screens?s=Player-lesson" />
      </div>
    );
  }
  const completion = COMPLETION_FIXTURES[screen];
  return (
    <div className="lp page-content">
      <div className="ls" data-state="completed">
        <LessonHeader subtitle="Урок 1 из 5 · Основы предложения" counter="Готово" ratio={1} progressLabel="Пройдено шагов: 10 из 10" onExit={noop} />
        <LessonComplete
          completion={completion}
          skillTitle="Present Simple"
          lessonUrl="/dev/screens?s=Lesson-current"
          pathUrl="/dev/screens?s=Curriculum"
          onRetry={noop}
          retrying={false}
          onRetryXp={noop}
        />
      </div>
    </div>
  );
}

export function LessonGalleryScreen({ s }: { s: LessonScreen }) {
  if (!isPlayerScreen(s)) return <StaticScreen screen={s} />;
  if (PlayerStand) return <PlayerStand key={s} screen={s} />;
  return (
    <div className="lp page-content">
      <h1 className="lp-hero-title">Интерактивный стенд плеера</h1>
      <p className="m-0 text-sm text-[var(--text-secondary)]">Доступен только в `next dev`: он содержит настоящий сервис вместе с ответами банка.</p>
    </div>
  );
}
