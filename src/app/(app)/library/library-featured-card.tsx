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
      className="focus-ring group relative flex h-44 items-end overflow-hidden rounded-3xl p-5 text-white shadow-[0_18px_50px_-20px_rgba(31,77,59,0.45)] sm:h-52"
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
        <span aria-hidden className="absolute inset-0 flex items-center justify-center text-8xl font-bold text-white/15">
          {initials}
        </span>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" aria-hidden="true" />
      <div className="relative flex w-full flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-white/80">Продолжить чтение</span>
        <p className="text-2xl font-bold leading-tight sm:text-3xl">{item.title}</p>
        <div className="mt-1 flex items-center gap-3">
          <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${item.percentRead}%` }} />
          </div>
          <span className="shrink-0 text-xs font-semibold text-white/85">{item.percentRead}%</span>
        </div>
      </div>
    </Link>
  );
}
