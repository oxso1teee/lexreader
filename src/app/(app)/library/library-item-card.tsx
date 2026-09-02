"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { coverGradient, coverInitials, youtubeThumbnailUrl } from "@/lib/text-cover";
import { typeLabel, type LibraryItem } from "./library-item";
import { deleteText } from "./actions";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

function formatPartsCount(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} часть`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} части`;
  return `${count} частей`;
}

export default function LibraryItemCard({ item }: { item: LibraryItem }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [gradientA, gradientB] = coverGradient(item.title);
  const initials = coverInitials(item.title);
  const typeIcon = item.kind === "collection" ? "📚" : item.youtubeVideoId ? "📺" : "📖";
  const showThumb = item.youtubeVideoId && !thumbFailed;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
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
        className="flex flex-1 flex-col focus-ring"
        aria-label={`${typeLabel(item)}: ${item.title}`}
      >
        <div
          className="relative flex h-26 items-end p-2.5 text-white"
          style={{ background: showThumb ? undefined : `linear-gradient(135deg, ${gradientA}, ${gradientB})`, height: "6.5rem" }}
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
            <span aria-hidden className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-white/20">
              {initials}
            </span>
          )}
          <span className="absolute left-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/35 text-xs backdrop-blur-sm">
            {typeIcon}
          </span>
          <span className="absolute right-2.5 top-2.5 rounded-full bg-white/85 px-2 py-0.5 text-[10px] font-bold uppercase text-black">
            {item.language}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <p className="line-clamp-2 text-sm font-bold leading-snug">{item.title}</p>
          <p className="text-xs text-[var(--text-secondary)]">
            {item.kind === "collection" ? formatPartsCount(item.partCount ?? 0) : typeLabel(item)}
            {item.levelTag ? ` · ${item.levelTag.toUpperCase()}` : ""}
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-[var(--color-forest)]"
              style={{ width: `${Math.min(100, item.percentRead)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
            <span>
              {item.savedWordsCount > 0 || item.savedPhrasesCount > 0
                ? `🔤 ${item.savedWordsCount + item.savedPhrasesCount} слов`
                : "Пока без слов"}
            </span>
            <span>{item.lastReadAt ? `Открыто: ${formatDate(item.lastReadAt)}` : "Ещё не открыт"}</span>
          </div>
          <span className="mt-auto flex min-h-10 items-center justify-center rounded-lg border border-[var(--border-strong)] text-xs font-bold text-[var(--color-forest-text)] transition-colors group-hover:border-[var(--color-forest)] group-hover:bg-[var(--color-forest-tint)]">
            {item.percentRead >= 100
              ? "Перечитать"
              : item.percentRead > 0
                ? "Продолжить →"
                : "Начать →"}
          </span>
        </div>
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
          className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white opacity-0 backdrop-blur-sm transition-opacity focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
        >
          ✕
        </button>
      )}
    </div>
  );
}
