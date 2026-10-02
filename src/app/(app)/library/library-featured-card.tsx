"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { youtubeThumbnailUrl } from "@/lib/text-cover";
import { CoverArt } from "@/components/product/cover-art";
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
  const showThumb = item.youtubeVideoId && !thumbFailed;

  return (
    <Link
      href={item.href}
      prefetch={false}
      aria-label={`Продолжить: ${typeLabel(item)} ${item.title}`}
      className="focus-ring group relative flex h-[108px] items-end overflow-hidden rounded-[20px] p-4 text-white sm:h-[140px]"
    >
      {/* Phase 7: та же иллюстрированная обложка, что у LibraryItemCard. */}
      <CoverArt title={item.title} isVideo={Boolean(item.youtubeVideoId)} banner>
        {showThumb ? (
          <Image
            src={youtubeThumbnailUrl(item.youtubeVideoId!)}
            alt=""
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : undefined}
      </CoverArt>
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
