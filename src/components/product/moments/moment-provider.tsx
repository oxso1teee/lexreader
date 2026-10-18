"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { currentBatch, dismiss, emptyQueue, enqueue, type MomentQueueState } from "@/lib/moments/queue";
import type { Moment } from "@/lib/moments/types";
import { GoalDoneScreen } from "./screens/goal-done";
import { StreakUpScreen } from "./screens/streak-up";
import { PerfectScreen } from "./screens/perfect";
import { LevelUpScreen } from "./screens/level-up";
import { AchievementScreen } from "./screens/achievement";
import { WordMasteredScreen } from "./screens/word-mastered";

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
  }
}

export function MomentProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<MomentQueueState>(() => emptyQueue());
  // true только на клиенте после гидрации — портал в document.body.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const pushMoments = useCallback((moments: readonly Moment[]) => {
    // Показанные раньше (в т.ч. в прошлых сессиях) отсекаем при первом же push.
    setQueue((q) => enqueue({ ...q, seen: new Set([...q.seen, ...readSeen()]) }, moments));
  }, []);

  const current = currentBatch(queue)[0] ?? null;

  const close = useCallback(() => {
    if (!current) return;
    setQueue((q) => {
      const next = dismiss(q, current.id);
      writeSeen(next.seen);
      return next;
    });
  }, [current]);

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
