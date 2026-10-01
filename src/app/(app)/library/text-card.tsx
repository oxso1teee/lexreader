"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Video, X } from "lucide-react";
import { deleteText } from "./actions";

const WORDS_PER_MINUTE = 200;

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

export default function TextCard({
  id,
  title,
  wordCount,
  levelTag,
  canDelete,
  percentRead,
  lastReadAt,
  youtubeVideoId,
}: {
  id: string;
  title: string;
  wordCount: number | null;
  levelTag: string | null;
  canDelete: boolean;
  percentRead: number;
  lastReadAt: string | null;
  youtubeVideoId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const estimatedMinutes = wordCount ? Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE)) : null;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/read/${id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[var(--border-strong)] px-4 py-3 transition-colors hover:border-black/30 dark:hover:border-white/40"
      >
        <span className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium">
          {youtubeVideoId && <Video aria-hidden="true" className="h-4 w-4 shrink-0" />}
          {title}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {wordCount ?? "?"} слов
          {levelTag ? ` · ${levelTag}` : ""}
          {estimatedMinutes ? ` · ≈${estimatedMinutes} мин` : ""}
        </p>
        {lastReadAt && (
          <p className="mt-0.5 text-xs text-black/40 dark:text-white/40">
            Последнее чтение: {formatDate(lastReadAt)}
          </p>
        )}
        {percentRead > 0 && (
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-strong)]">
            <div
              className="h-full rounded-full bg-[var(--color-forest)]"
              style={{ width: `${percentRead}%` }}
            />
          </div>
        )}
        </span>
      </Link>
      {youtubeVideoId && (
        <Link
          href={`/watch/${id}`}
          aria-label="Смотреть с субтитрами"
          className="flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 text-sm font-medium"
        >
          <Video aria-hidden="true" className="h-4 w-4" />
          Смотреть
        </Link>
      )}
      {canDelete && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteText(id))}
          aria-label="Удалить текст"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--color-danger-text)] disabled:opacity-40"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
