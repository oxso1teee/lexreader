"use client";

import Link from "next/link";
import { useTransition } from "react";
import ProgressRing from "@/components/progress-ring";
import { IconTrash } from "@/components/icons";
import { deleteDeck } from "./actions";

export default function DeckCard({
  id,
  name,
  isDefault,
  cardCount,
  dueCount,
}: {
  id: string;
  name: string;
  isDefault: boolean;
  cardCount: number;
  dueCount: number;
}) {
  const [isPending, startTransition] = useTransition();
  const ratio = cardCount > 0 ? dueCount / cardCount : 0;

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
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl bg-card px-4 py-3 shadow-sm"
      >
        <ProgressRing size={38} strokeWidth={4} ratio={ratio} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{name}</p>
            {isDefault && (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong">
                Главная
              </span>
            )}
          </div>
          <p className="mt-0.5 flex gap-2 text-sm text-black/50 dark:text-white/50">
            <span>{cardCount} карт.</span>
            {dueCount > 0 && <span className="font-medium text-accent-strong">{dueCount} к повтору</span>}
          </p>
        </div>
        <span className="text-black/30 dark:text-white/30">›</span>
      </Link>
      {/* Найдено при живой проверке: удаление колоды "Главная" ломает
          addPhraseToDefaultDeck (сохранение слова из читалки в карточку) —
          он ищет колоду с is_default=true, а после удаления её не остаётся
          и UI не даёт назначить другую колоду главной. Просто не даём
          удалить эту конкретную колоду. */}
      {!isDefault && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Удалить колоду"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-danger disabled:opacity-40 dark:border-white/15"
        >
          <IconTrash className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
