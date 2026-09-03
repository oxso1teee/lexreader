"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { coverGradient, coverInitials } from "@/lib/text-cover";
import EmptyState from "@/components/empty-state";

// Today mockup alignment — референс: горизонтальная карточка с маленькой
// обложкой 32×42 (тот же градиент-по-заголовку, что уже используют
// library-featured-card.tsx/library-item-card.tsx через text-cover.ts,
// без новых запросов к БД — coverGradient/coverInitials чистые функции
// от title), название + "Продолжить · N%", шеврон справа. Раньше это был
// текст + отдельный ProgressBar под ним, без обложки вообще.
export default function ContinueLearningCard({
  material,
}: {
  material: { textId: string; title: string; percentRead: number } | null;
}) {
  if (!material) {
    return (
      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <EmptyState
          icon="📖"
          title="Пока нет материала в процессе"
          body="Начни читать что-нибудь — прогресс появится здесь."
          action={
            <Link href="/library" className="focus-ring text-body-sm font-semibold text-[var(--color-forest-text)]">
              Открыть библиотеку →
            </Link>
          }
        />
      </div>
    );
  }

  const [gradientA, gradientB] = coverGradient(material.title);
  const initials = coverInitials(material.title);

  return (
    <Link
      href={`/read/${material.textId}`}
      onClick={() => track("continue_learning_clicked", { destination: `/read/${material.textId}` })}
      className="focus-ring flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-card p-[11px] shadow-sm"
    >
      <span
        aria-hidden="true"
        className="flex h-[42px] w-8 shrink-0 items-center justify-center rounded-[6px] text-[9px] font-bold text-white/70"
        style={{ background: `linear-gradient(150deg, ${gradientA}, ${gradientB})` }}
      >
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-bold">{material.title}</p>
        <p className="text-[10px] text-[var(--text-secondary)]">Продолжить · {material.percentRead}%</p>
      </div>
      <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
    </Link>
  );
}
