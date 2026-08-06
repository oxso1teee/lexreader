import Link from "next/link";
import { ConfidenceBadge, reasonLabel } from "./badges";
import type { LanguageTwinSummary } from "@/lib/language-twin/summary";

// Plan doc §11: a compact card for Today/Progress, never a second copy of
// the full Overview screen — just enough to notice something changed and a
// single link to /language-twin for the real detail.
export default function LanguageTwinSummaryCard({
  summary,
  variant,
}: {
  summary: LanguageTwinSummary;
  variant: "today" | "progress";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Мой английский</span>
        <ConfidenceBadge level={summary.confidence} />
      </div>

      {summary.focusTitle && (
        <p className="text-sm">
          <span className="text-[var(--text-secondary)]">В фокусе: </span>
          {summary.focusTitle}
        </p>
      )}

      {variant === "progress" && summary.strengthTitle && (
        <p className="text-sm">
          <span className="text-[var(--text-secondary)]">Сильная сторона: </span>
          {summary.strengthTitle}
        </p>
      )}

      {variant === "today" && summary.recommendationReasonKey && (
        <p className="text-sm text-[var(--text-secondary)]">{reasonLabel(summary.recommendationReasonKey)}</p>
      )}

      {!summary.focusTitle && !summary.strengthTitle && !summary.recommendationReasonKey && (
        <p className="text-sm text-[var(--text-secondary)]">Профиль обновляется по мере твоей активности.</p>
      )}

      <Link
        href="/language-twin"
        className="focus-ring self-start text-sm font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline"
      >
        Открыть «Мой английский» →
      </Link>
    </div>
  );
}
