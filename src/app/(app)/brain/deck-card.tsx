"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Layers, ChevronRight, X } from "lucide-react";
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
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border-l-4 border-forest bg-[var(--surface)] px-4 py-3"
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
              <span className="shrink-0 rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--text-secondary)]">
                Стартовая
              </span>
            )}
          </div>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
            <Layers aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {cardCount} карт.
            {dueCount !== undefined && newCount !== undefined && knownCount !== undefined && (
              <span>
                {" "}
                · {dueCount} к повторению · {newCount} новых · {knownCount} выучено
              </span>
            )}
          </p>
        </div>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
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
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--color-danger-text)] disabled:opacity-40"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
