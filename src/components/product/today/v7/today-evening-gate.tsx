"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import type { WeekdayMark } from "@/lib/moments/types";
import TodayEveningView from "./today-evening";

// docs/moments/mockups/Today-evening.dc.html — "вечернее состояние...
// после 18:00 по времени пользователя". Сервер не знает часовой пояс
// пользователя, поэтому решение чисто клиентское — тот же приём, что уже
// используется в review-session.tsx для speechSynthesis (useSyncExternalStore
// с getServerSnapshot=false, чтобы не словить hydration mismatch): на сервере
// и при первом клиентском рендере всегда обычный TodayView, вечерний вариант
// подменяет его следующим кадром после гидрации, если условия совпали.
function subscribeNoop(): () => void {
  return () => {};
}
function getEveningSnapshot(): boolean {
  return new Date().getHours() >= 18;
}
function getEveningServerSnapshot(): boolean {
  return false;
}

export default function TodayEveningGate({
  children,
  xpToday,
  streak,
  streakLongest,
  xp,
  langCode,
  level,
  week,
  freezeAvailable,
  reviewHref,
  reviewMinutesHint,
}: {
  children: ReactNode;
  xpToday: number;
  streak: number;
  streakLongest: number;
  xp: number;
  langCode: string;
  level: string | null;
  week: WeekdayMark[];
  freezeAvailable: boolean;
  reviewHref: string;
  reviewMinutesHint: number | null;
}) {
  const isEvening = useSyncExternalStore(subscribeNoop, getEveningSnapshot, getEveningServerSnapshot);
  const atRisk = isEvening && xpToday === 0 && streak > 0;

  if (!atRisk) return children;

  return (
    <TodayEveningView
      langCode={langCode}
      level={level}
      streak={streak}
      streakLongest={streakLongest}
      xp={xp}
      week={week}
      freezeAvailable={freezeAvailable}
      reviewHref={reviewHref}
      reviewMinutesHint={reviewMinutesHint}
    />
  );
}
