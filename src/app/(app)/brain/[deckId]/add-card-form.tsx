"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { addFlashcard, type AddCardState } from "./actions";
import { FREE_FLASHCARD_LIMIT } from "@/lib/subscription";
import MicButton from "@/components/mic-button";

export default function AddCardForm({
  deckId,
  targetLanguage,
  nativeLanguage,
}: {
  deckId: string;
  targetLanguage: string;
  nativeLanguage: string;
}) {
  const action = addFlashcard.bind(null, deckId);
  const [state, formAction, pending] = useActionState<AddCardState, FormData>(action, {});
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const submittedRef = useRef(false);

  // front/back стали управляемыми полями (нужно для голосового ввода —
  // MicButton пишет распознанный текст напрямую в состояние), поэтому
  // встроенный сброс формы React после успешного action на них больше не
  // действует (это относится только к неконтролируемым полям) — очищаем
  // вручную по завершении успешного добавления.
  useEffect(() => {
    if (submittedRef.current && !pending && !state.error && !state.paywall) {
      submittedRef.current = false;
      setFront("");
      setBack("");
    }
  }, [pending, state]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="flex flex-col gap-2 rounded-xl border border-black/10 p-3 dark:border-white/15"
    >
      <div className="flex gap-2">
        <div className="flex w-1/2 items-center gap-1 rounded-lg border border-black/15 pr-1 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/40">
          <input
            name="front"
            value={front}
            onChange={(e) => setFront(e.target.value)}
            placeholder="Слово"
            required
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <MicButton lang={targetLanguage} onResult={setFront} />
        </div>
        <div className="flex w-1/2 items-center gap-1 rounded-lg border border-black/15 pr-1 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/40">
          <input
            name="back"
            value={back}
            onChange={(e) => setBack(e.target.value)}
            placeholder="Перевод"
            required
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <MicButton lang={nativeLanguage} onResult={setBack} />
        </div>
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
          <Link href="/pricing?reason=cards" className="text-[var(--color-caramel-text)] underline">
            Смотреть Premium
          </Link>
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-11 items-center justify-center self-start rounded-full bg-caramel px-4 text-sm font-medium text-black disabled:opacity-50"
      >
        {pending ? "…" : "+ Добавить карточку"}
      </button>
    </form>
  );
}
