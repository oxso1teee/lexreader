"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createText, type CreateTextState } from "../actions";
import { FREE_TEXT_LIMIT } from "@/lib/subscription";

export default function NewTextForm() {
  const [state, formAction, pending] = useActionState<CreateTextState, FormData>(
    createText,
    {},
  );

  if (state.paywall) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
        <p className="text-xl font-semibold">Лимит бесплатного тарифа</p>
        <p className="text-black/60 dark:text-white/60">
          На бесплатном тарифе можно держать до {FREE_TEXT_LIMIT} текстов одновременно. Оформи
          Premium, чтобы добавлять сколько угодно.
        </p>
        <Link
          href="/paywall?reason=texts"
          className="mt-2 rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Смотреть Premium
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <input
        type="text"
        name="title"
        required
        placeholder="Название текста"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <textarea
        name="body"
        required
        rows={16}
        placeholder="Вставь текст на изучаемом языке…"
        className="w-full flex-1 resize-none rounded-lg border border-black/10 px-4 py-3 text-base leading-7 outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? "Сохраняем…" : "Добавить в библиотеку"}
      </button>
    </form>
  );
}
