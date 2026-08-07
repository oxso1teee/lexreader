"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentStreak, getLanguageTwinUpdateAction, type LanguageTwinSessionUpdate } from "./actions";
import { StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";

export default function SessionComplete({
  count,
  newRecord = false,
}: {
  count: number;
  newRecord?: boolean;
}) {
  const [streak, setStreak] = useState<number | null>(null);
  const [twinUpdate, setTwinUpdate] = useState<LanguageTwinSessionUpdate | null>(null);

  useEffect(() => {
    getCurrentStreak().then(setStreak);
    getLanguageTwinUpdateAction().then(setTwinUpdate);
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
      <Link
        href="/brain"
        className="mt-4 rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
      >
        К практике
      </Link>
    </div>
  );
}
