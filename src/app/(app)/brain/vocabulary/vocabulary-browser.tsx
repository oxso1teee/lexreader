"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { VocabularyRow } from "@/lib/vocabulary-list";
import { bulkMoveToDeck, bulkMarkKnown, bulkDeleteFlashcards } from "./actions";
import NewDeckModal from "../new-deck-modal";
import ImportModal from "../import-modal";
import DeckList from "../deck-list";
import StarterDeckCard from "../starter-deck-card";
import { STARTER_DECKS } from "@/lib/starter-decks";
import { track } from "@/lib/posthog-client";

type Section = "vocabulary" | "decks";
// M3 Slice 10 (brief Phase B §1) — one compact filter row combining both axes the brief asks
// for (item type, and learning state/due) into a single, explicit 8-option list rather than two
// separate control groups — matches "compact filters... do not add 20 filters."
type VocabFilter = "all" | "word" | "phrase" | "new" | "learning" | "familiar" | "active" | "due";
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

const FILTER_LABELS: Record<VocabFilter, string> = {
  all: "Все",
  word: "Слова",
  phrase: "Фразы",
  new: "Новые",
  learning: "Изучаются",
  familiar: "Знакомые",
  active: "Активные",
  due: "К повторению",
};

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Недавно добавленные",
  alpha: "По алфавиту",
  due: "Сначала к повторению",
  hardest: "Сначала сложные",
  "most-reviewed": "Больше всего повторений",
};

function matchesFilter(row: VocabularyRow, filter: VocabFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "word":
      return row.itemType === "word";
    case "phrase":
      return row.itemType === "phrase";
    case "due":
      return row.schedulerBucket === "due";
    default:
      return row.learningState === filter;
  }
}

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
  const [section, setSection] = useState<Section>("vocabulary");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VocabFilter>("all");
  const [deckFilter, setDeckFilter] = useState<string>("all");
  const [sourceOnly, setSourceOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [moveTargetDeck, setMoveTargetDeck] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    track("vocabulary_viewed", { initial_tab: filter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trackFilterChange(filterType: string, value: string) {
    track("vocabulary_filter_changed", { filter_type: filterType, value });
  }

  const filtered = useMemo(() => {
    const byFilter = rows.filter((r) => matchesFilter(r, filter));
    const byDeck = deckFilter === "all" ? byFilter : byFilter.filter((r) => r.deckId === deckFilter);
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
  }, [rows, filter, deckFilter, sourceOnly, query, sort]);

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
      if (result.ok) {
        track("vocabulary_bulk_action_used", { action: "mark_known" });
        clearSelection();
      }
    });
  }

  function handleBulkMove() {
    if (!moveTargetDeck) return;
    const ids = selectedRows.map((r) => r.flashcardId);
    startTransition(async () => {
      const result = await bulkMoveToDeck(ids, moveTargetDeck);
      setActionMessage(result.ok ? `Перемещено: ${result.count}` : (result.error ?? "Ошибка"));
      if (result.ok) {
        track("vocabulary_bulk_action_used", { action: "move" });
        clearSelection();
      }
    });
  }

  function handleBulkDelete() {
    if (!confirm(`Удалить ${selectedRows.length} карточек? Их история повторений будет удалена безвозвратно.`)) return;
    const ids = selectedRows.map((r) => r.flashcardId);
    startTransition(async () => {
      const result = await bulkDeleteFlashcards(ids);
      setActionMessage(result.ok ? `Удалено: ${result.count}` : (result.error ?? "Ошибка"));
      if (result.ok) {
        track("vocabulary_bulk_action_used", { action: "delete" });
        clearSelection();
      }
    });
  }

  function handleExportSelected() {
    track("vocabulary_bulk_action_used", { action: "export" });
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
        {(["vocabulary", "decks"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => {
              setSection(s);
              clearSelection();
            }}
            className={`-mb-px flex min-h-11 items-center gap-1 border-b-2 px-2 text-sm font-medium transition-colors ${
              section === s
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-[var(--text-secondary)] hover:text-black/70 dark:hover:text-white/70"
            }`}
          >
            {s === "vocabulary" ? "Словарь" : "📚 Колоды"}
          </button>
        ))}
      </div>

      {section === "decks" ? (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <NewDeckModal deckCount={newDeckCount} atLimit={newDeckAtLimit} />
            <ImportModal decks={decks.map((d) => ({ id: d.id, name: d.name }))} targetLanguage={targetLanguage} />
          </div>
          {showStarterDecks && (
            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <h2 className="mb-1 font-semibold">Стартовые колоды</h2>
              <p className="mb-3 text-xs text-[var(--text-secondary)]">
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
          <label htmlFor="vocabulary-search" className="sr-only">
            Поиск слов и фраз
          </label>
          <input
            id="vocabulary-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск слов и фраз..."
            className="w-full rounded-lg border border-black/15 bg-card px-4 py-2.5 outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
          />

          <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр словаря">
            {(Object.keys(FILTER_LABELS) as VocabFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => {
                  setFilter(f);
                  trackFilterChange("vocab_filter", f);
                }}
                className={`focus-ring min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium ${
                  filter === f
                    ? "border-caramel bg-caramel/15 text-[var(--color-caramel-text)]"
                    : "border-black/10 text-black/60 dark:border-white/15 dark:text-white/60"
                }`}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select
              aria-label="Фильтр по колоде"
              value={deckFilter}
              onChange={(e) => {
                const value = e.target.value;
                setDeckFilter(value);
                // M3 Slice 4 §17: "specific" вместо реального deck id — id
                // достаточно, чтобы соотнести событие с конкретной колодой,
                // а бриф прямо запрещает любую deck-идентифицирующую
                // информацию в payload.
                trackFilterChange("deck", value === "all" ? "all" : "specific");
              }}
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
              aria-label="Сортировка"
              onChange={(e) => {
                const value = e.target.value as SortKey;
                setSort(value);
                trackFilterChange("sort", value);
              }}
              className="rounded-lg border border-black/15 bg-card px-2 py-1.5 text-sm dark:border-white/20"
            >
              {(Object.keys(SORT_LABELS) as SortKey[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-black/60 dark:text-white/60">
              <input
                type="checkbox"
                checked={sourceOnly}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSourceOnly(checked);
                  trackFilterChange("source_only", String(checked));
                }}
              />
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
                aria-label="Переместить в колоду"
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
              <button type="button" onClick={clearSelection} className="ml-auto text-xs text-[var(--text-secondary)] underline">
                Снять выбор
              </button>
            </div>
          )}
          {actionMessage && <p className="text-xs text-[var(--text-secondary)]">{actionMessage}</p>}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-2xl">🔤</p>
              <p className="font-medium">
                {query || filter !== "all" || deckFilter !== "all" || sourceOnly
                  ? "Ничего не найдено по этим условиям"
                  : "Пока нет слов и фраз"}
              </p>
              {!query && filter === "all" && deckFilter === "all" && !sourceOnly && (
                <p className="max-w-xs text-sm text-[var(--text-secondary)]">
                  Сохраняй слова и фразы прямо во время чтения — тапни по слову в тексте — или добавь вручную.
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
                  <Link
                    href={`/brain/vocabulary/${r.flashcardId}`}
                    className="focus-ring flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {r.isPhrase && <span aria-hidden="true">💬 </span>}
                        {r.front}
                      </p>
                      <p className="truncate text-sm text-[var(--text-secondary)]">
                        {r.back} · {r.deckName}
                        {r.contextCount > 0 && ` · ${r.contextCount} контекст${r.contextCount === 1 ? "" : "а"}`}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <LearningStateBadge state={r.learningState} />
                      {r.schedulerBucket === "due" && <DueBadge />}
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LearningStateBadge({ state }: { state: VocabularyRow["learningState"] }) {
  const config: Record<VocabularyRow["learningState"], { label: string; className: string }> = {
    new: { label: "Новое", className: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60" },
    learning: { label: "Учу", className: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300" },
    familiar: { label: "Знакомое", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
    active: { label: "Активное", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    maintenance: { label: "Поддерживается", className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  };
  const c = config[state];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${c.className}`}>{c.label}</span>;
}

function DueBadge() {
  return (
    <span className="shrink-0 rounded-full bg-caramel/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-caramel-text)]">
      К повторению
    </span>
  );
}
