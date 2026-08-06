"use client";

import { useState, useTransition } from "react";
import { addStarterDeck } from "./starter-deck-actions";
import type { StarterDeckDef } from "@/lib/starter-decks";

export default function StarterDeckCard({
  def,
  alreadyAdded,
}: {
  def: StarterDeckDef;
  alreadyAdded: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(alreadyAdded);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addStarterDeck(def.level);
      if (result.ok) {
        setAdded(true);
      } else {
        setError(result.error ?? "Не удалось добавить колоду.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-2.5 text-sm dark:border-white/15">
      <div className="min-w-0">
        <p className="font-medium">{def.title}</p>
        <p className="truncate text-[var(--text-secondary)]">{def.description}</p>
        {error && <p className="mt-1 text-red-600 dark:text-red-400">{error}</p>}
      </div>
      {added ? (
        <span className="shrink-0 text-[var(--text-secondary)]">✓ Добавлено</span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={handleAdd}
          className="flex min-h-9 shrink-0 items-center rounded-full bg-caramel px-3 font-medium text-black disabled:opacity-50"
        >
          {isPending ? "Добавляем…" : "+ Добавить"}
        </button>
      )}
    </div>
  );
}
