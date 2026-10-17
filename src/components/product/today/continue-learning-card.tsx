"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { track } from "@/lib/posthog-client";
import { Card, CardLink } from "@/components/ui/card";
import { CoverArt } from "@/components/product/cover-art";

// Горизонтальная карточка "продолжить чтение": обложка (тот же градиент-по-
// заголовку, что у library-featured-card.tsx/library-item-card.tsx через
// text-cover.ts — чистые функции от title, без запросов к БД), название,
// прогресс, шеврон. redesign/duolingo-flat phase 6: оболочка — CardLink/Card
// вместо rounded-2xl bg-card shadow-sm, обложка крупнее под ячейку bento.
// Phase 7: обложка — CoverArt (мотив + grain/блик/корешок), как в Library.
export default function ContinueLearningCard({
  material,
  isVideo = false,
  className,
}: {
  material: { textId: string; title: string; percentRead: number } | null;
  /** texts.youtube_video_id задан — фиксированный "video"-мотив обложки. */
  isVideo?: boolean;
  className?: string;
}) {
  // Пустое состояние — та же горизонтальная раскладка, что у заполненной
  // карточки (плашка на месте обложки), а не общий EmptyState с py-16:
  // в ячейке bento тот раздувал весь ряд и растягивал соседнюю плитку.
  if (!material) {
    return (
      <Card className={`flex items-center gap-4 ${className ?? ""}`}>
        <span
          aria-hidden="true"
          className="flex h-[72px] w-[54px] shrink-0 items-center justify-center rounded-[10px] bg-[var(--color-forest-tint)]"
        >
          <BookOpen className="h-6 w-6 text-[var(--color-forest-text)]" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-bold tracking-wide text-[var(--text-secondary)] uppercase">Продолжить чтение</p>
          <p className="font-bold">Пока нет материала в процессе</p>
          <p className="text-sm text-[var(--text-secondary)]">Начни читать что-нибудь — прогресс появится здесь.</p>
          <Link
            href="/library"
            className="focus-ring self-start text-body-sm font-semibold text-[var(--color-forest-text)]"
          >
            Открыть библиотеку →
          </Link>
        </div>
      </Card>
    );
  }

  // v7 (docs/moments/mockups/Main.dc.html): обложка 52×68, подпись, название,
  // тонкая полоса прогресса, процент справа — без шеврона.
  return (
    <CardLink
      href={`/read/${material.textId}`}
      onClick={() => track("continue_learning_clicked", { destination: `/read/${material.textId}` })}
      className={`flex items-center gap-3 !p-3 ${className ?? ""}`}
    >
      <span className="relative h-[68px] w-[52px] shrink-0 overflow-hidden rounded-[10px]">
        <CoverArt title={material.title} isVideo={isVideo} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-[.05em] text-[var(--text-secondary)] uppercase">Продолжить чтение</p>
        <p className="mt-[3px] truncate text-base font-bold">{material.title}</p>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          aria-label="Прочитано"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={material.percentRead}
        >
          <div className="h-full rounded-full bg-[var(--leaf)]" style={{ width: `${material.percentRead}%` }} />
        </div>
      </div>
      <span className="shrink-0 text-[13px] font-semibold text-[var(--text-secondary)]">{material.percentRead}%</span>
    </CardLink>
  );
}
