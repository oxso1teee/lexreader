"use client";

import { useTransition } from "react";
import { track } from "@/lib/posthog-client";
import { reasonLabel } from "@/components/product/language-twin/badges";
import { completeRecommendationAction, dismissRecommendationAction } from "./actions";

const PRIORITY_LABEL: Record<string, string> = { high: "Высокий приоритет", medium: "Средний приоритет", low: "Низкий приоритет" };
const PRIORITY_CLASS: Record<string, string> = {
  high: "bg-[var(--color-danger)]/15 text-[var(--color-danger-text)]",
  medium: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  low: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10",
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
    <div className="flex flex-col gap-2 rounded-xl bg-[var(--surface-muted)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[rec.priority] ?? PRIORITY_CLASS.low}`}>
          {PRIORITY_LABEL[rec.priority] ?? rec.priority}
        </span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{reasonLabel(rec.reason_key)}</p>
      {!compact && (
        <div className="flex flex-wrap gap-2 pt-1">
          <a href={target} onClick={handleOpen} className="focus-ring rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black">
            {ACTION_LABEL[rec.action_type] ?? "Открыть"}
          </a>
          <button
            type="button"
            onClick={handleComplete}
            disabled={isPending}
            className="focus-ring rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Выполнено
          </button>
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
        <a href={target} onClick={handleOpen} className="focus-ring self-start rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black">
          {ACTION_LABEL[rec.action_type] ?? "Открыть"}
        </a>
      )}
    </div>
  );
}
