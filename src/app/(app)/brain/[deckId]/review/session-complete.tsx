"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentStreak } from "./actions";

export default function SessionComplete({
  count,
  newRecord = false,
}: {
  count: number;
  newRecord?: boolean;
}) {
  const [streak, setStreak] = useState<number | null>(null);

  useEffect(() => {
    getCurrentStreak().then(setStreak);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-2xl font-semibold">Сессия завершена</p>
      <p className="text-black/60 dark:text-white/60">Повторено слов: {count}</p>
      {newRecord && (
        <p className="font-medium text-accent-strong">🏆 Новый личный рекорд сессии!</p>
      )}
      {streak !== null && <p className="text-black/60 dark:text-white/60">Стрик: {streak} 🔥</p>}
      <Link
        href="/library"
        className="mt-4 rounded-full bg-accent px-5 py-3 font-medium text-white"
      >
        К библиотеке
      </Link>
    </div>
  );
}
