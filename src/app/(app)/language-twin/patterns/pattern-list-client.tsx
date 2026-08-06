"use client";

import { useMemo, useState, useTransition } from "react";
import { track } from "@/lib/posthog-client";
import Dialog from "@/components/product/language-twin/dialog";
import { ConfidenceBadge, StatusBadge, TrendIndicator, CategoryBadge, categoryLabel } from "@/components/product/language-twin/badges";
import type { EvidenceRow, PatternRow } from "@/lib/language-twin/types";
import { deleteEvidenceAction, dismissPatternAction, markPatternInaccurateAction, restorePatternAction } from "../actions";

const EVIDENCE_TYPE_LABEL: Record<string, string> = {
  review_accuracy: "Повторение · Мозг",
  reading_activation_gap: "Чтение · Читалка",
  correction_match: "Проверка предложения",
  diagnostic_result: "Диагностика",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function PatternWords({ pattern }: { pattern: PatternRow }) {
  const words = (pattern.metadata_json as { words?: { headword: string; translation: string; accuracy: number }[] }).words ?? [];
  if (words.length === 0) return null;
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface-muted)] p-3">
      <p className="text-xs font-semibold text-[var(--text-secondary)]">Примеры из твоих данных</p>
      {words.slice(0, 5).map((w, i) => (
        <p key={i} className="text-sm">
          <span className="font-medium">{w.headword}</span> — {w.translation}{" "}
          <span className="text-[var(--text-secondary)]">({Math.round(w.accuracy * 100)}% точность)</span>
        </p>
      ))}
    </div>
  );
}

function PatternDetail({
  pattern,
  evidence,
  onClose,
}: {
  pattern: PatternRow;
  evidence: EvidenceRow[];
  onClose: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const metadata = pattern.metadata_json as { markedInaccurate?: boolean };

  return (
    <Dialog titleId={`pattern-${pattern.id}-title`} title={pattern.title} onClose={onClose}>
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={pattern.category} />
          <StatusBadge status={pattern.status} />
          <ConfidenceBadge level={pattern.confidence} />
          <TrendIndicator trend={pattern.trend} />
        </div>
        <p>{pattern.description}</p>
        <div className="rounded-lg bg-[var(--color-info)]/10 p-3">
          <p className="text-xs text-[var(--text-secondary)]">
            Источник: сравнение реальных данных твоего чтения и повторений — ничего не собиралось специально
            для этого вывода.
          </p>
        </div>
        <PatternWords pattern={pattern} />
        <p className="text-xs text-[var(--text-secondary)]">
          Это может быть неточно — паттерн строится на ограниченном наборе примеров, не на полном понимании
          грамматики.
        </p>

        <div>
          <p className="mb-1 text-xs font-semibold text-[var(--text-secondary)]">Свидетельства ({evidence.length})</p>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {evidence.length === 0 && <p className="py-2 text-[var(--text-secondary)]">Нет свидетельств.</p>}
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p>{e.evidence_type === "diagnostic_result" ? `Результат диагностики: ${e.result}` : e.result ?? e.evidence_type}</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {EVIDENCE_TYPE_LABEL[e.evidence_type] ?? e.source_type} · {formatDate(e.occurred_at)}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Удалить это свидетельство"
                  disabled={isPending}
                  onClick={() => {
                    track("evidence_deleted", { source_type: e.source_type });
                    startTransition(() => deleteEvidenceAction(e.id));
                  }}
                  className="focus-ring flex min-h-9 min-w-9 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-black disabled:opacity-40 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              track("pattern_marked_inaccurate", { category: pattern.category });
              startTransition(() => markPatternInaccurateAction(pattern.id));
            }}
            className="focus-ring rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {metadata.markedInaccurate ? "✓ Отмечено как неточное" : "Отметить как неточное"}
          </button>
          {pattern.status === "dismissed" ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => startTransition(() => restorePatternAction(pattern.id))}
              className="focus-ring rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Вернуть паттерн
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                track("pattern_dismissed", { category: pattern.category });
                startTransition(() => dismissPatternAction(pattern.id));
              }}
              className="focus-ring rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Скрыть паттерн
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

export default function PatternListClient({
  patterns,
  evidenceByPattern,
}: {
  patterns: PatternRow[];
  evidenceByPattern: Record<string, EvidenceRow[]>;
}) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return patterns.filter((p) => p.status !== "dismissed");
    return patterns.filter((p) => p.status === statusFilter);
  }, [patterns, statusFilter]);

  const selected = patterns.find((p) => p.id === selectedId) ?? null;
  const categories = useMemo(() => Array.from(new Set(patterns.map((p) => p.category))), [patterns]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по статусу">
        {[
          ["all", "Все активные"],
          ["active", "Активные"],
          ["improving", "Улучшаются"],
          ["resolved", "Решённые"],
          ["dismissed", "Скрытые"],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatusFilter(value)}
            aria-pressed={statusFilter === value}
            className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-medium ${
              statusFilter === value
                ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                : "border-[var(--border-strong)] text-[var(--text-secondary)]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {categories.length > 0 && (
        <p className="text-xs text-[var(--text-secondary)]">
          Категории найдены: {categories.map((c) => categoryLabel(c)).join(", ")}
        </p>
      )}

      <div className="flex flex-col gap-2 rounded-2xl bg-card p-2 shadow-sm">
        {filtered.length === 0 ? (
          <p className="p-3 text-sm text-[var(--text-secondary)]">Нет паттернов в этом фильтре.</p>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                track("pattern_opened", { category: p.category, confidence: p.confidence });
                setSelectedId(p.id);
              }}
              className="focus-ring flex flex-col gap-1.5 rounded-xl p-3 text-left hover:bg-[var(--surface-muted)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">{p.title}</span>
                <StatusBadge status={p.status} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge category={p.category} />
                <ConfidenceBadge level={p.confidence} />
                <TrendIndicator trend={p.trend} />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {p.evidence_count} свидетельств · последнее — {formatDate(p.last_seen_at)}
              </p>
            </button>
          ))
        )}
      </div>

      {selected && (
        <PatternDetail
          pattern={selected}
          evidence={evidenceByPattern[selected.id] ?? []}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
