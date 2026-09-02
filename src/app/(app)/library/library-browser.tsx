"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { track } from "@/lib/posthog-client";
import EmptyState from "@/components/empty-state";
import LibraryFeaturedCard from "./library-featured-card";
import LibraryItemCard from "./library-item-card";
import {
  matchesFilter,
  matchesSearch,
  materialsCountLabel,
  type LibraryItem,
  type LibraryTypeFilter,
} from "./library-item";

const FILTERS: { value: LibraryTypeFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "collection", label: "Книги" },
  { value: "video", label: "Видео" },
  { value: "text", label: "Тексты" },
  { value: "completed", label: "Завершённые" },
];

export default function LibraryBrowser({ items }: { items: LibraryItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [filter, setFilter] = useState<LibraryTypeFilter>((searchParams.get("filter") as LibraryTypeFilter) ?? "all");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTracked = useRef(false);

  useEffect(() => {
    track("library_viewed", { count: items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced URL sync — reflects search/filter state so a reload or shared
  // link preserves it, without sending the query text itself anywhere
  // (docs/ui/m3-slice3-library-reader-plan.md §9: never send search text to PostHog).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (filter !== "all") params.set("filter", filter);
      const qs = params.toString();
      router.replace(qs ? `/library?${qs}` : "/library", { scroll: false });
      if (query.trim() && !searchTracked.current) {
        track("library_search_used");
        searchTracked.current = true;
      }
      if (!query.trim()) searchTracked.current = false;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, filter]);

  function handleFilterChange(next: LibraryTypeFilter) {
    setFilter(next);
    track("library_filter_changed", { filter: next });
  }

  // "Одна крупная обложка «продолжить» сверху + ровная сетка ниже" — только
  // в дефолтном виде (без поиска/фильтра), чтобы не путать намерение
  // пользователя, когда он явно что-то ищет/фильтрует. Самый недавно
  // открытый материал в процессе (не 0%, ещё не завершён) — тот же
  // критерий "в процессе", что уже использует ContinueLearningCard на
  // Today (src/components/product/today/continue-learning-card.tsx).
  const isDefaultView = filter === "all" && !query.trim();
  const featured = useMemo(() => {
    if (!isDefaultView) return null;
    const inProgress = items.filter((i) => i.percentRead > 0 && i.percentRead < 100 && i.lastReadAt);
    if (inProgress.length === 0) return null;
    return [...inProgress].sort((a, b) => (a.lastReadAt! < b.lastReadAt! ? 1 : -1))[0];
  }, [items, isDefaultView]);

  const filtered = useMemo(
    () =>
      items
        .filter((item) => item.id !== featured?.id)
        .filter((item) => matchesFilter(item, filter) && matchesSearch(item, query)),
    [items, filter, query, featured],
  );

  if (items.length === 0) {
    return (
      <EmptyState
        icon="📚"
        title="Библиотека пока пуста"
        body="Добавь первый текст, статью, YouTube-видео или PDF — LexReader сохранит незнакомые слова и предложит повторение."
        action={
          <a
            href="/library/new"
            className="focus-ring mt-2 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--color-forest)] px-5 text-sm font-bold text-white"
          >
            ＋ Добавить первый материал
          </a>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1 max-w-sm">
          <label htmlFor="library-search" className="sr-only">
            Поиск по библиотеке
          </label>
          <input
            id="library-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти материал…"
            className="focus-ring w-full rounded-full border border-[var(--border-strong)] bg-[var(--surface)] py-2.5 pl-4 pr-9 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="focus-ring absolute right-1.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр материалов">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => handleFilterChange(f.value)}
            aria-pressed={filter === f.value}
            className={`focus-ring min-h-9 rounded-full border px-3.5 text-xs font-bold transition-colors ${
              filter === f.value
                ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-white"
                : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {featured && <LibraryFeaturedCard item={featured} />}

      {filtered.length === 0 ? (
        // Единственный материал в библиотеке — сам featured выше (не
        // настоящее пустое состояние, фильтровать/искать нечего).
        !featured && <EmptyState icon="🔍" title="Ничего не нашлось" body="Попробуй другой запрос или сними фильтр." />
      ) : (
        <>
          <p className="text-xs text-[var(--text-secondary)]" aria-live="polite">
            {materialsCountLabel(filtered.length)}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => (
              <LibraryItemCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
