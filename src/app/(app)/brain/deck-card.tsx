"use client";

import Link from "next/link";
import { useTransition } from "react";
import { deleteDeck } from "./actions";

export default function DeckCard({
  id,
  name,
  isDefault,
  isStarter,
  cardCount,
  dueCount,
  newCount,
  knownCount,
}: {
  id: string;
  name: string;
  isDefault: boolean;
  isStarter: boolean;
  cardCount: number;
  dueCount?: number;
  newCount?: number;
  knownCount?: number;
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

  // M3 Slice 4 §11: is_starter теперь тоже защищена от удаления, как и
  // is_default (см. actions.ts) — раньше deck-card.tsx получал только
  // isDefault, и стартовую колоду можно было удалить прямо из UI.
  const canDelete = !isDefault && !isStarter;

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/brain/${id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border-l-4 border-forest bg-card px-4 py-3 shadow-sm"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{name}</p>
            {isDefault && (
              <span className="shrink-0 rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-[#7d5d3e]">
                Главная
              </span>
            )}
            {isStarter && (
              <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
                Стартовая
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            📚 {cardCount} карт.
            {dueCount !== undefined && newCount !== undefined && knownCount !== undefined && (
              <span>
                {" "}
                · {dueCount} к повторению · {newCount} новых · {knownCount} выучено
              </span>
            )}
          </p>
        </div>
        <span aria-hidden="true" className="text-black/30 dark:text-white/30">›</span>
      </Link>
      {/* Найдено при живой проверке: удаление колоды "Главная" ломает
          addPhraseToDefaultDeck (сохранение слова из читалки в карточку) —
          он ищет колоду с is_default=true, а после удаления её не остаётся
          и UI не даёт назначить другую колоду главной. Просто не даём
          удалить эту конкретную колоду (и стартовые — общий бесплатный
          ресурс, см. actions.ts). */}
      {canDelete && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleDelete}
          aria-label="Удалить колоду"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-black/10 text-red-500 disabled:opacity-40 dark:border-white/15"
        >
          ✕
        </button>
      )}
    </div>
  );
}
