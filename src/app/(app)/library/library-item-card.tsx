"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { coverGradient, coverInitials, youtubeThumbnailUrl } from "@/lib/text-cover";
import { typeLabel, type LibraryItem } from "./library-item";
import { deleteText } from "./actions";

// Library mockup alignment — раньше это была двухчастная карточка (h-26
// обложка сверху + отдельный белый блок с текстом/прогрессом/CTA снизу).
// Референс хочет плотную photo-grid плитку: обложка на всю карточку
// (aspect-[3/4]), название — единственный текст, поверх затемняющего
// градиента снизу, тот же паттерн, что у LibraryFeaturedCard, только
// меньше. Языковой бейдж/иконка типа/уровень/счётчик слов/дата/CTA-текст
// с плитки убраны — это была декоративная метаинформация, не
// интерактивная функциональность (вся карточка уже была и остаётся
// единой <Link>, клик работает как раньше; aria-label по-прежнему несёт
// typeLabel+title для скринридеров). Кнопка удаления — единственное
// НЕ-навигационное действие на карточке — оставлена, иначе это была бы
// реальная потеря функциональности, не только визуала.
export default function LibraryItemCard({ item }: { item: LibraryItem }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [gradientA, gradientB] = coverGradient(item.title);
  const initials = coverInitials(item.title);
  const showThumb = item.youtubeVideoId && !thumbFailed;

  return (
    <div className="group relative aspect-[3/4] overflow-hidden rounded-[14px] text-white shadow-sm">
      {/* prefetch={false}: /read|/watch/[id] have no loading.js boundary, so
          Next's default prefetch fetches the FULL dynamic route (every DB
          query the Reader page makes) for every card the moment it enters
          the viewport. A grid of 20+ materials was firing dozens of these
          concurrently on every Library load — confirmed via CI diagnostics
          to be severe enough to starve the actual click-triggered navigation
          under load. Wasteful for real users too (most cards are never opened
          in a session) and unnecessary DB/bandwidth cost at any real scale. */}
      <Link
        href={item.href}
        prefetch={false}
        aria-label={`${typeLabel(item)}: ${item.title}`}
        className="focus-ring flex h-full w-full flex-col justify-end p-[9px]"
        style={{ background: showThumb ? undefined : `linear-gradient(150deg, ${gradientA}, ${gradientB})` }}
      >
        {showThumb && (
          // Free, keyless YouTube thumbnail — i.ytimg.com allowlisted in
          // next.config.ts's images.remotePatterns.
          <Image
            src={youtubeThumbnailUrl(item.youtubeVideoId!)}
            alt=""
            fill
            sizes="(min-width: 1024px) 20vw, 45vw"
            className="object-cover"
            onError={() => setThumbFailed(true)}
          />
        )}
        {!showThumb && (
          <span aria-hidden className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/15">
            {initials}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/[0.35] to-transparent" aria-hidden="true" />
        <p className="relative line-clamp-2 text-[10.5px] font-bold leading-tight">{item.title}</p>
      </Link>

      {item.canDelete && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (confirm(`Удалить «${item.title}» из библиотеки?`)) {
              startTransition(() => deleteText(item.id));
            }
          }}
          aria-label={`Удалить «${item.title}»`}
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
        >
          ✕
        </button>
      )}
    </div>
  );
}
