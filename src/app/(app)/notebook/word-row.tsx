"use client";

import { useTransition } from "react";
import { deleteWord, markKnown } from "./actions";

export default function WordRow({
  id,
  headword,
  translation,
  sourceTitle,
  status,
}: {
  id: string;
  headword: string;
  translation: string;
  sourceTitle: string | null;
  status: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-4 py-3 dark:border-white/15">
      <div className="min-w-0">
        <p className="font-medium">{headword}</p>
        <p className="truncate text-sm text-black/50 dark:text-white/50">
          {translation}
          {sourceTitle ? ` · ${sourceTitle}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {status !== "known" && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => markKnown(id))}
            className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium hover:border-black/30 disabled:opacity-40 dark:border-white/15 dark:hover:border-white/40"
          >
            Уже знаю
          </button>
        )}
        <button
          type="button"
          disabled={isPending}
          onClick={() => startTransition(() => deleteWord(id))}
          className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:border-red-300 disabled:opacity-40 dark:border-white/15 dark:text-red-400 dark:hover:border-red-800"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
