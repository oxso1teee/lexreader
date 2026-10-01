"use client";

import { useTransition } from "react";
import { track } from "@/lib/posthog-client";
import { Button, ButtonLink } from "@/components/ui/button";
import { reasonLabel } from "@/components/product/language-twin/badges";
import { completeRecommendationAction, dismissRecommendationAction } from "./actions";

const PRIORITY_LABEL: Record<string, string> = { high: "Высокий приоритет", medium: "Средний приоритет", low: "Низкий приоритет" };
const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-[var(--color-danger)]/15 text-[var(--color-danger-text)]",
  medium: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  // --foreground, не --text-secondary: карточка сама на bg-[var(--border)],
  // и вторая полупрозрачная подложка опускала вторичный текст до 4.32:1 в
  // тёмной теме (ниже AA). С --foreground — 7.18:1 dark / 11.68:1 light.
  low: "bg-[var(--border)] text-[var(--foreground)]",
};
const ACTION_LABEL: Record<string, string> = {
  open_custom_session: "Начать сессию",
  open_correction_input: "Открыть проверку предложения",
  start_diagnostic: "Пройти диагностику",
  open_review: "Открыть повторение",
};

export interface RecommendationCardData {
  id: string;
  recommendation_type: string;
  priority: string;
  reason_key: string;
  action_type: string;
  action_target_json: Record<string, unknown>;
}

export default function RecommendationCard({ rec, compact = false }: { rec: RecommendationCardData; compact?: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleDismiss() {
    track("recommendation_dismissed", { recommendation_type: rec.recommendation_type });
    startTransition(() => dismissRecommendationAction(rec.id));
  }
  function handleComplete() {
    startTransition(() => completeRecommendationAction(rec.id));
  }
  function handleOpen() {
    track("recommendation_opened", { recommendation_type: rec.recommendation_type, priority: rec.priority });
  }

  const flashcardIds = Array.isArray(rec.action_target_json.flashcardIds)
    ? (rec.action_target_json.flashcardIds as unknown[]).filter((id): id is string => typeof id === "string")
    : [];
  const target =
    rec.action_type === "open_custom_session"
      ? flashcardIds.length > 0
        ? `/brain/all/review?mode=cards&wordIds=${encodeURIComponent(flashcardIds.join(","))}`
        : "/brain/all/review?mode=cards"
      : rec.action_type === "open_correction_input"
        ? "/language-twin/correction"
        : rec.action_type === "start_diagnostic"
          ? "/language-twin/diagnostic"
          : "/brain/all/review";

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--border)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[rec.priority] ?? PRIORITY_CLASS.low}`}>
          {PRIORITY_LABEL[rec.priority] ?? rec.priority}
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{reasonLabel(rec.reason_key)}</p>
      {!compact && (
        <div className="flex flex-wrap gap-2 pt-1">
          <ButtonLink href={target} onClick={handleOpen} variant="leaf" size="sm">
            {ACTION_LABEL[rec.action_type] ?? "Открыть"}
          </ButtonLink>
          <Button variant="ghost" size="sm" onClick={handleComplete} disabled={isPending}>
            Выполнено
          </Button>
          <button
            type="button"
            onClick={handleDismiss}
            disabled={isPending}
            className="focus-ring text-sm font-medium text-[var(--text-secondary)] underline-offset-2 hover:underline disabled:opacity-50"
          >
            Скрыть
          </button>
        </div>
      )}
      {compact && (
        <ButtonLink href={target} onClick={handleOpen} variant="leaf" size="sm" className="self-start">
          {ACTION_LABEL[rec.action_type] ?? "Открыть"}
        </ButtonLink>
      )}
    </div>
  );
}
