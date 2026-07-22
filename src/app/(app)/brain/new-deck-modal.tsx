"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createDeck, type DeckFormState } from "./actions";
import { FREE_DECK_LIMIT } from "@/lib/subscription";

export default function NewDeckModal() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DeckFormState, FormData>(createDeck, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-caramel px-4 py-2 text-sm font-medium text-white"
      >
        + Новая колода
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5">
            <h2 className="mb-4 text-center text-lg font-bold">Новая колода</h2>
            <form action={formAction} className="flex flex-col gap-3">
              <input
                type="text"
                name="name"
                autoFocus
                required
                placeholder="Название колоды..."
                className="w-full rounded-lg border border-black/20 px-4 py-2.5 outline-none focus:border-black dark:border-white/25 dark:focus:border-white"
              />
              {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
              {state.paywall && (
                <p className="text-sm text-black/60 dark:text-white/60">
                  На бесплатном тарифе можно создать до {FREE_DECK_LIMIT} колод.{" "}
                  <Link href="/pricing?reason=decks" className="text-caramel underline">
                    Смотреть Premium
                  </Link>
                </p>
              )}
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-full bg-black/10 py-2.5 font-medium dark:bg-white/10"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-full bg-caramel py-2.5 font-medium text-white disabled:opacity-50"
                >
                  {pending ? "…" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
