"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import WordRow from "./word-row";
import EmptyState from "./empty-state";
import PracticeSession, { type PracticeWord } from "./practice-session";
import AddWordModal from "./add-word-modal";

const STATUS_TABS = [
  { value: "", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "learning", label: "Изучаются" },
  { value: "known", label: "Выучены" },
];

interface WordItem {
  id: string;
  headword: string;
  translation: string;
  status: string;
  photo_url: string | null;
  sourceTitle: string | null;
}

export default function NotebookClient({
  ownerId,
  items,
  allWords,
  status,
  targetLanguage,
  sourceLang,
  nativeLang,
}: {
  ownerId: string;
  items: WordItem[];
  allWords: PracticeWord[];
  status: string;
  targetLanguage: string;
  sourceLang: string;
  nativeLang: string;
}) {
  const [mode, setMode] = useState<"read" | "practice">("read");
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.headword.toLowerCase().includes(q) || i.translation.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">✏️ Тетрадь</h1>
          <p className="text-sm text-black/50 dark:text-white/50">{targetLanguage}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-black/15 dark:border-white/20">
            {(["read", "practice"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`flex min-h-11 items-center px-3 text-sm font-medium transition-colors ${
                  mode === m
                    ? "bg-caramel text-white"
                    : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
                }`}
              >
                {m === "read" ? "Чтение" : "Повтор"}
              </button>
            ))}
          </div>
          <AddWordModal sourceLang={sourceLang} targetLang={nativeLang} />
        </div>
      </div>

      {mode === "read" ? (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Поиск по тетради..."
            className="mb-3 w-full rounded-lg border border-black/15 bg-card px-4 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
          />

          <div className="mb-3 flex items-center justify-between">
            <a
              href="/api/export/vocabulary"
              download
              className="text-sm text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              Экспорт CSV
            </a>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value ? `/notebook?status=${tab.value}` : "/notebook"}
                className={`flex min-h-11 shrink-0 items-center rounded-full border px-3 text-sm font-medium transition-colors ${
                  status === tab.value
                    ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                    : "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </div>

          {filteredItems.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredItems.map((item) => (
                <WordRow
                  key={item.id}
                  id={item.id}
                  ownerId={ownerId}
                  headword={item.headword}
                  translation={item.translation}
                  sourceTitle={item.sourceTitle}
                  status={item.status}
                  photoUrl={item.photo_url}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <PracticeSession words={allWords} />
      )}
    </div>
  );
}
