"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { coverGradient, coverInitials, youtubeThumbnailUrl } from "@/lib/text-cover";
import { typeLabel, type LibraryItem } from "./library-item";

// docs/release-2026-08-26/12_VIZUALNAYA_IDENTICHNOST_RESHENIE_2026-08-26.md
// — "одна крупная обложка «продолжить» сверху + ровная сетка ниже" вместо
// плоской сетки одинакового размера для всего, включая то, что уже
// читается прямо сейчас. Один item (см. library-browser.tsx — самый
// недавно открытый среди 0 < percentRead < 100) вынесен сюда, крупнее и
// с прогресс-баром поверх обложки, а не рядовой плиткой в сетке ниже.
//
// Library mockup alignment — компактнее (108-140px вместо 176-208px),
// прогресс теперь тонкая (3px) полоса во всю ширину карточки снизу (как
// read-progress в /read/[textId]), не отдельный блок с текстовым
// процентом внутри отступа.
export default function LibraryFeaturedCard({ item }: { item: LibraryItem }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [gradientA, gradientB] = coverGradient(item.title);
  const initials = coverInitials(item.title);
  const showThumb = item.youtubeVideoId && !thumbFailed;

  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-label={`Продолжить: ${typeLabel(item)} ${item.title}`}
      className="focus-ring group relative flex h-[108px] items-end overflow-hidden rounded-[20px] p-4 text-white shadow-[0_18px_50px_-20px_rgba(31,77,59,0.45)] sm:h-[140px]"
      style={{ background: showThumb ? undefined : `linear-gradient(150deg, ${gradientA}, ${gradientB})` }}
    >
      {showThumb && (
        <Image
          src={youtubeThumbnailUrl(item.youtubeVideoId!)}
          alt=""
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover"
          onError={() => setThumbFailed(true)}
        />
      )}
      {!showThumb && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center text-6xl font-bold text-white/15">
          {initials}
        </span>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/[0.35] to-transparent" aria-hidden="true" />
      <div className="relative flex w-full flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/85">Продолжаешь</span>
        <p className="text-[15px] font-bold leading-tight">{item.title}</p>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/25" aria-hidden="true">
        <div className="h-full bg-white/90" style={{ width: `${item.percentRead}%` }} />
      </div>
    </Link>
  );
}
