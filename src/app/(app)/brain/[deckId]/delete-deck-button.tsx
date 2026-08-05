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
      className="rounded-full border border-red-200 py-2 text-sm font-medium text-red-600 disabled:opacity-50 dark:border-red-900"
    >
      {isPending ? "…" : "Удалить колоду"}
    </button>
  );
}
