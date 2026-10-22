"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { currentBatch, dismiss, emptyQueue, enqueue, type MomentQueueState } from "@/lib/moments/queue";
import type { Moment, MomentKind } from "@/lib/moments/types";
import { useIsNativePlatform } from "@/lib/use-is-native";
import { maybeRateAppMoment } from "./rate-app-actions";
import { GoalDoneScreen } from "./screens/goal-done";
import { StreakUpScreen } from "./screens/streak-up";
import { PerfectScreen } from "./screens/perfect";
import { LevelUpScreen } from "./screens/level-up";
import { AchievementScreen } from "./screens/achievement";
import { WordMasteredScreen } from "./screens/word-mastered";
import { Streak30Screen } from "./screens/streak-30";
import { FreezeUsedScreen } from "./screens/freeze-used";
import { PerfectWeekScreen } from "./screens/perfect-week";
import { EarnBackScreen } from "./screens/earn-back";
import { OvertakenScreen } from "./screens/overtaken";
import { WeeklyRankScreen } from "./screens/weekly-rank";
import { FriendStreakScreen } from "./screens/friend-streak";
import { NotifyAskScreen } from "./screens/notify-ask";
import { WelcomeBackScreen } from "./screens/welcome-back";
import { RateAppScreen } from "./screens/rate-app";
import { WeekRecapScreen } from "./screens/week-recap";

// Очередь моментов на всё приложение. Серверное действие возвращает
// moments[] → вызывающий клиент делает pushMoments(result.moments), или
// страница рендерит <ShowMoments moments={...} />. Показанные id
// запоминаются в localStorage, чтобы перезагрузка не повторяла праздник;
// серверный журнал показов — этап 1 (docs/moments/ROADMAP.md).

const SEEN_KEY = "lexreader.moments.seen";
const SEEN_LIMIT = 200;

interface MomentsApi {
  pushMoments: (moments: readonly Moment[]) => void;
}

const MomentsContext = createContext<MomentsApi | null>(null);
const noopSubscribe = () => () => {};

function readSeen(): string[] {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeSeen(seen: ReadonlySet<string>) {
  try {
    window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-SEEN_LIMIT)));
  } catch {
    // приватный режим / квота — не критично
  }
}

export function renderMoment(moment: Moment, onClose: () => void) {
  switch (moment.kind) {
    case "goal_done":
      return <GoalDoneScreen moment={moment} onClose={onClose} />;
    case "streak_up":
      return <StreakUpScreen moment={moment} onClose={onClose} />;
    case "perfect":
      return <PerfectScreen moment={moment} onClose={onClose} />;
    case "level_up":
      return <LevelUpScreen moment={moment} onClose={onClose} />;
    case "achievement":
      return <AchievementScreen moment={moment} onClose={onClose} />;
    case "word_mastered":
      return <WordMasteredScreen moment={moment} onClose={onClose} />;
    case "streak_milestone":
      return <Streak30Screen moment={moment} onClose={onClose} />;
    case "freeze_used":
      return <FreezeUsedScreen moment={moment} onClose={onClose} />;
    case "perfect_week":
      return <PerfectWeekScreen moment={moment} onClose={onClose} />;
    case "earn_back":
      return <EarnBackScreen moment={moment} onClose={onClose} />;
    case "overtaken":
      return <OvertakenScreen moment={moment} onClose={onClose} />;
    case "weekly_rank":
      return <WeeklyRankScreen moment={moment} onClose={onClose} />;
    case "friend_streak":
      return <FriendStreakScreen moment={moment} onClose={onClose} />;
    case "notify_ask":
      return <NotifyAskScreen moment={moment} onClose={onClose} />;
    case "welcome_back":
      return <WelcomeBackScreen moment={moment} onClose={onClose} />;
    case "rate_app":
      return <RateAppScreen moment={moment} onClose={onClose} />;
    case "week_recap":
      return <WeekRecapScreen moment={moment} onClose={onClose} />;
  }
}

// docs/moments/ROADMAP.md, этап 7 — Rate-app триггерится "после
// положительного момента", не после любого (earn_back/freeze_used не
// праздник, их не считаем).
const POSITIVE_MOMENT_KINDS: ReadonlySet<MomentKind> = new Set([
  "goal_done",
  "streak_up",
  "perfect",
  "level_up",
  "achievement",
  "word_mastered",
  "streak_milestone",
  "perfect_week",
]);

export function MomentProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<MomentQueueState>(() => emptyQueue());
  // true только на клиенте после гидрации — портал в document.body.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isNative = useIsNativePlatform();

  const pushMoments = useCallback((moments: readonly Moment[]) => {
    // Показанные раньше (в т.ч. в прошлых сессиях) отсекаем при первом же push.
    setQueue((q) => enqueue({ ...q, seen: new Set([...q.seen, ...readSeen()]) }, moments));
  }, []);

  const current = currentBatch(queue)[0] ?? null;

  const close = useCallback(() => {
    if (!current) return;
    const wasPositive = POSITIVE_MOMENT_KINDS.has(current.kind);
    setQueue((q) => {
      const next = dismiss(q, current.id);
      writeSeen(next.seen);
      return next;
    });
    // docs/moments/ROADMAP.md, этап 7 — только нативная сборка, не чаще
    // раза в 120 дней (сторож внутри maybeRateAppMoment), только вслед за
    // позитивным моментом — ровно требование задачи.
    if (isNative && wasPositive) {
      void maybeRateAppMoment().then((moment) => {
        if (moment) pushMoments([moment]);
      });
    }
  }, [current, isNative, pushMoments]);

  const api = useMemo(() => ({ pushMoments }), [pushMoments]);

  return (
    <MomentsContext.Provider value={api}>
      {children}
      {mounted && current && createPortal(<div key={current.id}>{renderMoment(current, close)}</div>, document.body)}
    </MomentsContext.Provider>
  );
}

export function useMoments(): MomentsApi {
  const ctx = useContext(MomentsContext);
  if (!ctx) throw new Error("useMoments() вне <MomentProvider>");
  return ctx;
}

/** Для серверных страниц: отдать моменты, посчитанные при рендере. */
export function ShowMoments({ moments }: { moments: readonly Moment[] }) {
  const { pushMoments } = useMoments();
  useEffect(() => {
    if (moments.length) pushMoments(moments);
  }, [moments, pushMoments]);
  return null;
}
