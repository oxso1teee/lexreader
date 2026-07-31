"use client";

import { useState } from "react";

// Раздел 5 промта 2026-07-30 (композиция): "Мои тексты" / "Текст дня" /
// "Библиотека приложения" были тремя отдельными секциями подряд — теперь
// одна полка-контейнер с вкладками, текст дня виден сразу в каталоге.
export default function LibraryShelf({
  defaultTab,
  mine,
  featured,
  catalog,
}: {
  defaultTab: "mine" | "catalog";
  mine: React.ReactNode;
  featured: React.ReactNode;
  catalog: React.ReactNode;
}) {
  const [tab, setTab] = useState<"mine" | "catalog">(defaultTab);

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setTab("mine")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            tab === "mine"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50"
          }`}
        >
          Мои
        </button>
        <button
          type="button"
          onClick={() => setTab("catalog")}
          className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            tab === "catalog"
              ? "bg-black text-white dark:bg-white dark:text-black"
              : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50"
          }`}
        >
          Каталог
        </button>
      </div>

      {tab === "mine" && mine}
      {tab === "catalog" && (
        <div className="flex flex-col gap-4">
          {featured}
          {catalog}
        </div>
      )}
    </div>
  );
}
