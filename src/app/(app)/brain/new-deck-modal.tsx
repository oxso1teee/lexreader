"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createDeck, type DeckFormState } from "./actions";
import { FREE_DECK_LIMIT } from "@/lib/subscription";
import { track } from "@/lib/posthog-client";

// M3 Slice 4 §12: deckCount/atLimit are computed server-side from the same
// query hasFreeDeckRoom() itself uses (src/lib/subscription.ts) — the limit
// is shown and enforced in the UI *before* submit, not just discovered
// after a failed create. The post-submit {paywall:true} branch stays as
// defense-in-depth (e.g. two tabs racing to create the 3rd deck at once).
export default function NewDeckModal({
  deckCount,
  atLimit,
}: {
  deckCount: number;
  atLimit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<DeckFormState, FormData>(createDeck, {});

  // M3 Slice 4 §16: редкий race (atLimit=false при открытии, но лимит уже
  // достигнут ко времени сабмита — например вторая вкладка) — тот же
  // defense-in-depth путь, что и сам paywall-гейт в actions.ts.
  useEffect(() => {
    if (state.paywall) track("deck_create_blocked_by_limit");
  }, [state.paywall]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          // M3 Slice 4 §16: события взаимоисключающие по состоянию на момент
          // открытия — atLimit уже посчитан на сервере той же функцией,
          // что и сам гейт (hasFreeDeckRoom), так что "started" всегда
          // означает реальную попытку, а не форму, которая тут же откажет.
          track(atLimit ? "deck_create_blocked_by_limit" : "deck_create_started");
        }}
        className="rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black"
      >
        + Новая колода
      </button>

      {open && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5">
            <h2 className="mb-1 text-center text-lg font-bold">Новая колода</h2>
            <p className="mb-4 text-center text-xs text-[var(--text-secondary)]">
              {deckCount} / {FREE_DECK_LIMIT} колод использовано
            </p>
            {atLimit ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-black/60 dark:text-white/60">
                  На бесплатном тарифе можно создать до {FREE_DECK_LIMIT} колод. Чтобы создать ещё одну,
                  перейди на Premium.
                </p>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-full bg-black/10 py-2.5 font-medium dark:bg-white/10"
                  >
                    Закрыть
                  </button>
                  <Link
                    href="/pricing?reason=decks"
                    className="flex-1 rounded-full bg-caramel py-2.5 text-center font-medium text-black"
                  >
                    Смотреть Premium
                  </Link>
                </div>
              </div>
            ) : (
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
                    <Link href="/pricing?reason=decks" className="text-[var(--color-caramel-text)] underline">
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
                    className="flex-1 rounded-full bg-caramel py-2.5 font-medium text-black disabled:opacity-50"
                  >
                    {pending ? "…" : "Создать"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
