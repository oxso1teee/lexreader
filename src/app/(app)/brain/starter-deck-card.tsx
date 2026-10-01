"use client";

import { Check } from "lucide-react";
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
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{def.title}</p>
        <p className="truncate text-[var(--text-secondary)]">{def.description}</p>
        {error && <p className="mt-1 text-[var(--color-danger-text)]">{error}</p>}
      </div>
      {added ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-[var(--text-secondary)]">
          <Check aria-hidden="true" className="h-4 w-4" />
          Добавлено
        </span>
      ) : (
        <button
          type="button"
          disabled={isPending}
          onClick={handleAdd}
          className="flex min-h-9 shrink-0 items-center rounded-full bg-forest px-3 font-medium text-white disabled:opacity-50"
        >
          {isPending ? "Добавляем…" : "+ Добавить"}
        </button>
      )}
    </div>
  );
}
