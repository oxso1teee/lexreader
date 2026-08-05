"use client";

import { useMemo, useState, useTransition } from "react";
import type { VocabularyRow, SchedulerBucket } from "@/lib/vocabulary-list";
import { bulkMoveToDeck, bulkMarkKnown, bulkDeleteFlashcards } from "./actions";
import NewDeckModal from "../new-deck-modal";
import ImportModal from "../import-modal";
import DeckList from "../deck-list";
import StarterDeckCard from "../starter-deck-card";
import { STARTER_DECKS } from "@/lib/starter-decks";
import ItemDetailsSheet from "./item-details-sheet";

type Tab = "words" | "phrases" | "decks";
type BucketFilter = "all" | SchedulerBucket;
type SortKey = "recent" | "alpha" | "due" | "hardest" | "most-reviewed";

interface DeckSummary {
  id: string;
  name: string;
  isDefault: boolean;
  isStarter: boolean;
  cardCount: number;
  dueCount: number;
  newCount: number;
  knownCount: number;
}

const BUCKET_LABELS: Record<BucketFilter, string> = {
  all: "Все",
  due: "К повторению",
  new: "Новые",
  learning: "Учу",
  known: "Знаю",
};

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Недавно добавленные",
  alpha: "По алфавиту",
  due: "Сначала к повторению",
  hardest: "Сначала сложные",
  "most-reviewed": "Больше всего повторений",
};

function matchesQuery(row: VocabularyRow, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    row.front.toLowerCase().includes(needle) ||
    row.back.toLowerCase().includes(needle) ||
    (row.contextSentence?.toLowerCase().includes(needle) ?? false) ||
    row.deckName.toLowerCase().includes(needle)
  );
}

function toCsv(rows: VocabularyRow[]): string {
  const header = "front,back,deck,context\n";
  const body = rows
    .map((r) => [r.front, r.back, r.deckName, r.contextSentence ?? ""].map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  return "﻿" + header + body;
}

export default function VocabularyBrowser({
  rows,
  decks,
  targetLanguage,
  newDeckCount,
  newDeckAtLimit,
  showStarterDecks,
  addedStarterTitles,
}: {
  rows: VocabularyRow[];
  decks: DeckSummary[];
  targetLanguage: string;
  newDeckCount: number;
  newDeckAtLimit: boolean;
  showStarterDecks: boolean;
  addedStarterTitles: string[];
}) {
  const [tab, setTab] = useState<Tab>("words");
  const [query, setQuery] = useState("");
  const [bucketFilter, setBucketFilter] = useState<BucketFilter>("all");
  const [deckFilter, setDeckFilter] = useState<string>("all");
  const [sourceOnly, setSourceOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailsItem, setDetailsItem] = useState<VocabularyRow | null>(null);
  const [moveTargetDeck, setMoveTargetDeck] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const base = rows.filter((r) => (tab === "words" ? !r.isPhrase : r.isPhrase));
    const byBucket = bucketFilter === "all" ? base : base.filter((r) => r.schedulerBucket === bucketFilter);
    const byDeck = deckFilter === "all" ? byBucket : byBucket.filter((r) => r.deckId === deckFilter);
    const bySource = sourceOnly ? byDeck.filter((r) => r.sourceTextId) : byDeck;
    const byQuery = query.trim() ? bySource.filter((r) => matchesQuery(r, query.trim())) : bySource;

    return [...byQuery].sort((a, b) => {
      switch (sort) {
        case "alpha":
          return a.front.localeCompare(b.front);
        case "due":
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        case "hardest":
          if (a.accuracy === null && b.accuracy === null) return 0;
          if (a.accuracy === null) return 1;
          if (b.accuracy === null) return -1;
          return a.accuracy - b.accuracy;
        case "most-reviewed":
          return b.totalReviews - a.totalReviews;
        case "recent":
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [rows, tab, bucketFilter, deckFilter, sourceOnly, query, sort]);

  const selectedRows = filtered.filter((r) => selectedIds.has(r.flashcardId));
  const canMarkKnown =
    selectedRows.length > 0 && selectedRows.every((r) => r.vocabularyItemId !== null && r.knowledgeStatus !== "known");

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setActionMessage(null);
  }

  function handleBulkMarkKnown() {
    const ids = selectedRows.map((r) => r.vocabularyItemId).filter((id): id is string => !!id);
    startTransition(async () => {
      const result = await bulkMarkKnown(ids);
      setActionMessage(result.ok ? `Отмечено как «знаю»: ${result.count}` : (result.error ?? "Ошибка"));
      if (result.ok) clearSelection();
    });
  }

  function handleBulkMove() {
    if (!moveTargetDeck) return;
    const ids = selectedRows.map((r) => r.flashcardId);
    startTransition(async () => {
      const result = await bulkMoveToDeck(ids, moveTargetDeck);
      setActionMessage(result.ok ? `Перемещено: ${result.count}` : (result.error ?? "Ошибка"));
      if (result.ok) clearSelection();
    });
  }

  function handleBulkDelete() {
    if (!confirm(`Удалить ${selectedRows.length} карточек? Их история повторений будет удалена безвозвратно.`)) return;
    const ids = selectedRows.map((r) => r.flashcardId);
    startTransition(async () => {
      const result = await bulkDeleteFlashcards(ids);
      setActionMessage(result.ok ? `Удалено: ${result.count}` : (result.error ?? "Ошибка"));
      if (result.ok) clearSelection();
    });
  }

  function handleExportSelected() {
    const csv = toCsv(selectedRows.length > 0 ? selectedRows : filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vocabulary.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div className="flex gap-2 border-b border-black/10 dark:border-white/10">
        {(["words", "phrases", "decks"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              clearSelection();
            }}
            className={`-mb-px flex min-h-11 items-center gap-1 border-b-2 px-2 text-sm font-medium transition-colors ${
              tab === t
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            {t === "words" ? "🔤 Слова" : t === "phrases" ? "💬 Фразы" : "📚 Колоды"}
          </button>
        ))}
      </div>

      {tab === "decks" ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <NewDeckModal deckCount={newDeckCount} atLimit={newDeckAtLimit} />
            <ImportModal decks={decks.map((d) => ({ id: d.id, name: d.name }))} targetLanguage={targetLanguage} />
          </div>
          {showStarterDecks && (
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <h2 className="mb-1 font-semibold">Стартовые колоды</h2>
              <p className="mb-3 text-xs text-black/40 dark:text-white/40">
                Готовые наборы частых слов по уровням — не расходуют лимит бесплатного тарифа
              </p>
              <div className="flex flex-col gap-2">
                {Object.values(STARTER_DECKS).map((def) => (
                  <StarterDeckCard key={def.level} def={def} alreadyAdded={addedStarterTitles.includes(def.title)} />
                ))}
              </div>
            </div>
          )}
          <DeckList decks={decks} />
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "words" ? "Поиск слов..." : "Поиск фраз..."}
            className="w-full rounded-lg border border-black/15 bg-card px-4 py-2.5 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
          />

          <div className="flex flex-wrap gap-2">
            {(Object.keys(BUCKET_LABELS) as BucketFilter[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBucketFilter(b)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  bucketFilter === b
                    ? "border-caramel bg-caramel/15 text-caramel"
                    : "border-black/10 text-black/60 dark:border-white/15 dark:text-white/60"
                }`}
              >
                {BUCKET_LABELS[b]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              value={deckFilter}
              onChange={(e) => setDeckFilter(e.target.value)}
              className="rounded-lg border border-black/15 bg-card px-2 py-1.5 text-sm dark:border-white/20"
            >
              <option value="all">Все колоды</option>
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-black/15 bg-card px-2 py-1.5 text-sm dark:border-white/20"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
              <input type="checkbox" checked={sourceOnly} onChange={(e) => setSourceOnly(e.target.checked)} />
              Только из чтения
            </label>
          </div>

          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-caramel/40 bg-caramel/10 px-3 py-2 text-sm">
              <span className="font-medium">Выбрано: {selectedIds.size}</span>
              {canMarkKnown && (
                <button type="button" disabled={isPending} onClick={handleBulkMarkKnown} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-black/40">
                  Уже знаю
                </button>
              )}
              <select
                value={moveTargetDeck}
                onChange={(e) => setMoveTargetDeck(e.target.value)}
                className="rounded-full border border-black/15 bg-white px-2 py-1.5 text-xs dark:border-white/20 dark:bg-black/40"
              >
                <option value="">Переместить в…</option>
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              {moveTargetDeck && (
                <button type="button" disabled={isPending} onClick={handleBulkMove} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-black/40">
                  Переместить
                </button>
              )}
              <button type="button" onClick={handleExportSelected} className="rounded-full bg-white px-3 py-1.5 text-xs font-medium shadow-sm dark:bg-black/40">
                Экспорт
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleBulkDelete}
                className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Удалить
              </button>
              <button type="button" onClick={clearSelection} className="ml-auto text-xs text-black/50 underline dark:text-white/50">
                Снять выбор
              </button>
            </div>
          )}
          {actionMessage && <p className="text-xs text-black/50 dark:text-white/50">{actionMessage}</p>}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-2xl">{tab === "words" ? "🔤" : "💬"}</p>
              <p className="font-medium">
                {query || bucketFilter !== "all" || deckFilter !== "all" || sourceOnly
                  ? "Ничего не найдено по этим условиям"
                  : tab === "words"
                    ? "Пока нет сохранённых слов"
                    : "Пока нет сохранённых фраз"}
              </p>
              {!query && bucketFilter === "all" && deckFilter === "all" && !sourceOnly && (
                <p className="max-w-xs text-sm text-black/50 dark:text-white/50">
                  Сохраняй слова и фразы прямо во время чтения — тапни по слову в тексте.
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((r) => (
                <div
                  key={r.flashcardId}
                  className="flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(r.flashcardId)}
                    onChange={() => toggleSelect(r.flashcardId)}
                    aria-label={`Выбрать «${r.front}»`}
                    className="h-4 w-4 shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => setDetailsItem(r)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.front}</p>
                      <p className="truncate text-sm text-black/50 dark:text-white/50">
                        {r.back} · {r.deckName}
                      </p>
                    </div>
                    <SchedulerBadge bucket={r.schedulerBucket} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detailsItem && (
        <ItemDetailsSheet
          item={detailsItem}
          decks={decks.map((d) => ({ id: d.id, name: d.name }))}
          onClose={() => setDetailsItem(null)}
        />
      )}
    </div>
  );
}

function SchedulerBadge({ bucket }: { bucket: SchedulerBucket }) {
  const config: Record<SchedulerBucket, { label: string; className: string }> = {
    new: { label: "Новое", className: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60" },
    due: { label: "К повторению", className: "bg-caramel/15 text-caramel" },
    learning: { label: "Учу", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
    known: { label: "Знаю", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  };
  const c = config[bucket];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.className}`}>{c.label}</span>;
}
