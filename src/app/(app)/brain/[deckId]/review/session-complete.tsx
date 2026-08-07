"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentStreak, getLanguageTwinUpdateAction, type LanguageTwinSessionUpdate } from "./actions";
import { completeMissionAction } from "@/app/(app)/missions/actions";
import { track } from "@/lib/posthog-client";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import type { PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";

export default function SessionComplete({
  count,
  newRecord = false,
  missionId = null,
  missionCorrectCount = 0,
  missionIncorrectCount = 0,
}: {
  count: number;
  newRecord?: boolean;
  // Missions v1 §11-13: targeted missions (vocab_activation/review_recovery/
  // phrase_activation) redirect here with a real flashcard set — completing
  // this same Practice session IS completing the mission. missionCorrectCount/
  // missionIncorrectCount are the mode's own genuine per-card grades (see
  // each mode's tally state), never a fabricated number.
  missionId?: string | null;
  missionCorrectCount?: number;
  missionIncorrectCount?: number;
}) {
  const [streak, setStreak] = useState<number | null>(null);
  const [twinUpdate, setTwinUpdate] = useState<LanguageTwinSessionUpdate | null>(null);
  const [missionDone, setMissionDone] = useState(false);

  useEffect(() => {
    getCurrentStreak().then(setStreak);
    if (missionId) {
      completeMissionAction(missionId, { correct: missionCorrectCount, incorrect: missionIncorrectCount }).then(
        (result) => {
          setMissionDone(true);
          // No mission_type here (this path never learns it) — mirrors other
          // events in this table that carry no properties at all rather than
          // guessing or fetching just to enrich analytics.
          track("mission_completed", {});
          if (result?.languageTwinUpdate) {
            const u = result.languageTwinUpdate;
            setTwinUpdate({
              patternTitle: u.patternTitle,
              category: u.category as PatternCategory,
              status: u.status as PatternStatus,
              trend: u.trend as Trend,
            });
          } else {
            getLanguageTwinUpdateAction().then(setTwinUpdate);
          }
        },
      );
    } else {
      getLanguageTwinUpdateAction().then(setTwinUpdate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-2xl font-semibold">Сессия завершена</p>
      <p className="text-black/60 dark:text-white/60">Повторено слов: {count}</p>
      {newRecord && (
        <p className="font-medium text-[var(--color-caramel-text)]">🏆 Новый личный рекорд сессии!</p>
      )}
      {streak !== null && <p className="text-black/60 dark:text-white/60">Стрик: {streak} 🔥</p>}
      {twinUpdate && (
        <div className="mt-1 flex flex-col items-center gap-1.5 rounded-2xl bg-card p-3 shadow-sm">
          <p className="text-sm font-semibold">Мой английский обновлён</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <CategoryBadge category={twinUpdate.category} />
            <StatusBadge status={twinUpdate.status} />
            <TrendIndicator trend={twinUpdate.trend} />
          </div>
          <p className="text-xs text-black/60 dark:text-white/60">{twinUpdate.patternTitle}</p>
        </div>
      )}
      {missionId && missionDone && (
        <Link
          href={`/missions/${missionId}`}
          className="mt-2 rounded-full border border-black/15 px-5 py-3 font-medium hover:border-black/30 dark:border-white/20 dark:hover:border-white/40"
        >
          Посмотреть результат миссии →
        </Link>
      )}
      <Link
        href="/brain"
        className="mt-4 rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
      >
        К практике
      </Link>
    </div>
  );
}
