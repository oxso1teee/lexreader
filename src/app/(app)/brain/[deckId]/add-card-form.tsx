"use client";

import { useActionState } from "react";
import Link from "next/link";
import { addFlashcard, type AddCardState } from "./actions";
import { FREE_FLASHCARD_LIMIT } from "@/lib/subscription";

export default function AddCardForm({ deckId }: { deckId: string }) {
  const action = addFlashcard.bind(null, deckId);
  const [state, formAction, pending] = useActionState<AddCardState, FormData>(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-2 rounded-xl border border-black/10 p-3 dark:border-white/15">
      <div className="flex gap-2">
        <input
          name="front"
          placeholder="Слово"
          required
          className="w-1/2 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
        />
        <input
          name="back"
          placeholder="Перевод"
          required
          className="w-1/2 rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
        />
      </div>
      <input
        name="notes"
        placeholder="Заметка (необязательно)"
        className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
      />
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      {state.paywall && (
        <p className="text-sm text-black/60 dark:text-white/60">
          На бесплатном тарифе можно держать до {FREE_FLASHCARD_LIMIT} карточек.{" "}
          <Link href="/pricing?reason=cards" className="text-caramel underline">
            Смотреть Premium
          </Link>
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-caramel px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "…" : "+ Добавить карточку"}
      </button>
    </form>
  );
}
