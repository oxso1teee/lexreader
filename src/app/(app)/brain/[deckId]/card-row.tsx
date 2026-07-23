"use client";

import { useTransition } from "react";
import { deleteFlashcard } from "./actions";

export default function CardRow({
  deckId,
  id,
  front,
  back,
}: {
  deckId: string;
  id: string;
  front: string;
  back: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2 text-sm dark:border-white/15">
      <div className="min-w-0">
        <p className="truncate font-medium">{front}</p>
        <p className="truncate text-black/50 dark:text-white/50">{back}</p>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => startTransition(() => deleteFlashcard(deckId, id))}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-red-500 disabled:opacity-40"
        aria-label="Удалить карточку"
      >
        ✕
      </button>
    </div>
  );
}
