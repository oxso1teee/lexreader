"use client";

import { useMemo, useState, useTransition } from "react";
import { track } from "@/lib/posthog-client";
import type { EvidenceRow, EvidenceSourceType } from "@/lib/language-twin/types";
import { deleteEvidenceAction } from "../actions";

const SOURCE_LABEL: Record<EvidenceSourceType, string> = {
  flashcard: "Повторение · Мозг",
  vocabulary_item: "Чтение · Читалка",
  correction_submission: "Проверка предложения",
  diagnostic_session: "Диагностика",
};

const FILTERS: [string, string][] = [
  ["all", "Все"],
  ["flashcard", "Повторения"],
  ["vocabulary_item", "Чтение"],
  ["correction_submission", "Проверка предложений"],
  ["diagnostic_session", "Диагностика"],
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EvidenceListClient({ evidence }: { evidence: EvidenceRow[] }) {
  const [filter, setFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(
    () => evidence.filter((e) => !deletedIds.has(e.id) && (filter === "all" || e.source_type === filter)),
    [evidence, filter, deletedIds],
  );

  function handleDelete(id: string, sourceType: EvidenceSourceType) {
    track("evidence_deleted", { source_type: sourceType });
    setDeletedIds((prev) => new Set(prev).add(id));
    startTransition(() => deleteEvidenceAction(id));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по источнику">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-medium ${
              filter === value
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-[var(--border-strong)] text-[var(--text-secondary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)] rounded-2xl bg-card p-2 shadow-sm">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-[var(--text-secondary)]">Нет свидетельств в этой категории.</p>
        ) : (
          filtered.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm">
                  {e.evidence_type === "diagnostic_result" ? `Результат диагностики: ${e.result}` : e.result ?? e.evidence_type}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {SOURCE_LABEL[e.source_type]} · {formatDateTime(e.occurred_at)} · вклад: {e.confidence}
                </p>
              </div>
              <button
                type="button"
                aria-label="Удалить это свидетельство"
                disabled={isPending}
                onClick={() => handleDelete(e.id, e.source_type)}
                className="focus-ring flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-black disabled:opacity-40 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
