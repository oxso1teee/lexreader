import Link from "next/link";
import { ConfidenceBadge, reasonLabel } from "./badges";
import type { LanguageTwinEntryState } from "@/lib/language-twin/summary";

// Plan doc §11: a compact card for Today/Progress, never a second copy of
// the full Overview screen. Renders in two shapes — a real summary once
// there's enough evidence, or an always-visible "invite" while there isn't
// (see summary.ts's LanguageTwinEntryState) — but never nothing, so the
// feature stays discoverable from day one instead of only after 15 evidence
// rows have already piled up on their own.
export default function LanguageTwinSummaryCard({
  state,
  variant,
}: {
  state: LanguageTwinEntryState;
  variant: "today" | "progress";
}) {
  if (state.kind === "hidden") return null;

  if (state.kind === "invite") {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <span className="text-sm font-semibold">Мой английский</span>
        <p className="text-sm text-[var(--text-secondary)]">
          {variant === "today"
            ? "Оценка твоего английского на основе реальной активности — почитай что-нибудь, повтори карточки или пройди короткую диагностику."
            : "Пока собираем данные — почитай что-нибудь, повтори карточки в Мозге или пройди короткую диагностику, и здесь появится оценка."}
        </p>
        <Link
          href="/language-twin/diagnostic"
          className="focus-ring self-start rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
        >
          Пройти мини-диагностику
        </Link>
      </div>
    );
  }

  const { summary } = state;

  // Today's card leads with a concrete, actionable focus (real pattern +
  // its real description, e.g. "12 слов ты хорошо знаешь по чтению, но
  // регулярно не вспоминаешь...") instead of a generic "Мой английский"
  // label — the point is that the user sees today's actual grammar/vocab
  // focus without opening a separate diagnostic-style screen every day.
  if (variant === "today" && summary.focusTitle) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-[var(--text-secondary)]">Твой фокус сегодня</span>
          <ConfidenceBadge level={summary.confidence} />
        </div>
        <p className="text-sm font-semibold">{summary.focusTitle}</p>
        {summary.focusDescription && (
          <p className="text-sm text-[var(--text-secondary)]">{summary.focusDescription}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <Link
            href="/language-twin/correction"
            className="focus-ring rounded-full bg-forest px-4 py-2 text-sm font-medium text-white"
          >
            Потренировать 5 минут
          </Link>
          <Link
            href="/language-twin"
            className="focus-ring text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
          >
            Весь профиль →
          </Link>
        </div>
      </div>
    );
  }

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
        className="focus-ring self-start text-sm font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
      >
        Открыть «Мой английский» →
      </Link>
    </div>
  );
}
