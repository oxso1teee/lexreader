"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteDeck } from "./actions";

export default function DeckCard({
  id,
  name,
  isDefault,
  cardCount,
}: {
  id: string;
  name: string;
  isDefault: boolean;
  cardCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !window.confirm(
        `Удалить колоду «${name}»? Все карточки внутри (${cardCount}) и история их повторений будут удалены безвозвратно.`,
      )
    ) {
      return;
    }
    startTransition(() => deleteDeck(id));
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/brain/${id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border-l-4 border-caramel bg-card px-4 py-3 shadow-sm"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{name}</p>
            {isDefault && (
              <span className="shrink-0 rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-caramel">
                Главная
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-black/50 dark:text-white/50">📚 {cardCount} карт.</p>
        </div>
        <span className="text-black/30 dark:text-white/30">›</span>
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={handleDelete}
        aria-label="Удалить колоду"
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-red-500 disabled:opacity-40 dark:border-white/15"
      >
        ✕
      </button>
    </div>
  );
}
