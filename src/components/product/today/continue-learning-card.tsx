"use client";

import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { coverGradient, coverInitials } from "@/lib/text-cover";
import EmptyState from "@/components/empty-state";
import ProgressBar from "@/components/product/progress-bar";
import { Card, CardLink } from "@/components/ui/card";

// Горизонтальная карточка "продолжить чтение": обложка (тот же градиент-по-
// заголовку, что у library-featured-card.tsx/library-item-card.tsx через
// text-cover.ts — чистые функции от title, без запросов к БД), название,
// прогресс, шеврон. redesign/duolingo-flat phase 6: оболочка — CardLink/Card
// вместо rounded-2xl bg-card shadow-sm, обложка крупнее под ячейку bento.
export default function ContinueLearningCard({
  material,
  className,
}: {
  material: { textId: string; title: string; percentRead: number } | null;
  className?: string;
}) {
  if (!material) {
    return (
      <Card className={className}>
        <EmptyState
          icon={BookOpen}
          title="Пока нет материала в процессе"
          body="Начни читать что-нибудь — прогресс появится здесь."
          action={
            <Link href="/library" className="focus-ring text-body-sm font-semibold text-[var(--color-forest-text)]">
              Открыть библиотеку →
            </Link>
          }
        />
      </Card>
    );
  }

  const [gradientA, gradientB] = coverGradient(material.title);
  const initials = coverInitials(material.title);

  return (
    <CardLink
      href={`/read/${material.textId}`}
      onClick={() => track("continue_learning_clicked", { destination: `/read/${material.textId}` })}
      className={`flex items-center gap-4 ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="flex h-[72px] w-[54px] shrink-0 items-center justify-center rounded-[10px] text-xs font-bold text-white/75"
        style={{ background: `linear-gradient(150deg, ${gradientA}, ${gradientB})` }}
      >
        {initials}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">Продолжить чтение</p>
        <p className="truncate font-bold">{material.title}</p>
        <div className="flex items-center gap-2">
          <ProgressBar ratio={material.percentRead / 100} label="Прочитано" />
          <span className="shrink-0 font-mono text-xs font-bold">{material.percentRead}%</span>
        </div>
      </div>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
    </CardLink>
  );
}
