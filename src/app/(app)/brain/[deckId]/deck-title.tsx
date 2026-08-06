"use client";

import { useState, useTransition } from "react";
import { renameDeck } from "../actions";

// M3 Slice 4 §11: name уже была mutable-колонкой, просто не было UI —
// см. renameDeck() в ../actions.ts. isDefault/isStarter только объясняют
// ограничение на удаление здесь (сама защита — на сервере, в deleteDeck()),
// не блокируют rename.
export default function DeckTitle({
  deckId,
  name,
  isDefault,
  isStarter,
}: {
  deckId: string;
  name: string;
  isDefault: boolean;
  isStarter: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await renameDeck(deckId, value);
      if (result.ok) {
        setIsEditing(false);
        setError(null);
      } else {
        setError(result.error ?? "Не удалось переименовать.");
      }
    });
  }

  if (isEditing) {
    return (
      <div className="flex flex-1 items-center gap-2">
        <input
          aria-label="Название колоды"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          className="min-w-0 flex-1 rounded-lg border border-black/20 px-3 py-1.5 text-xl font-bold outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
        />
        <button type="button" disabled={isPending} onClick={handleSave} className="rounded-full bg-caramel px-3 py-1.5 text-sm font-medium text-black disabled:opacity-50">
          {isPending ? "…" : "OK"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(name);
            setIsEditing(false);
            setError(null);
          }}
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm dark:border-white/15"
        >
          Отмена
        </button>
        {error && <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <h1 className="truncate text-xl font-bold">{name}</h1>
      {isDefault && (
        <span className="shrink-0 rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-[#7d5d3e]">Главная</span>
      )}
      {isStarter && (
        <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-black/60 dark:bg-white/10 dark:text-white/60">
          Стартовая
        </span>
      )}
      <button type="button" onClick={() => setIsEditing(true)} aria-label="Переименовать колоду" className="flex min-h-9 min-w-9 shrink-0 items-center justify-center text-[var(--text-secondary)] hover:text-black dark:hover:text-white">
        ✎
      </button>
    </div>
  );
}
