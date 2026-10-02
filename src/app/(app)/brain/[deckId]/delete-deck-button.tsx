"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteDeck } from "../actions";

export default function DeleteDeckButton({ deckId, name, cardCount }: { deckId: string; name: string; cardCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !window.confirm(
        `Удалить колоду «${name}»? Все карточки внутри (${cardCount}) и история их повторений будут удалены безвозвратно.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deleteDeck(deckId);
      router.push("/brain/vocabulary");
    });
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleDelete}
      className="rounded-full border border-[var(--color-danger-text)]/40 py-2 text-sm font-medium text-[var(--color-danger-text)] disabled:opacity-50"
    >
      {isPending ? "…" : "Удалить колоду"}
    </button>
  );
}
