"use client";

import { useActionState } from "react";
import { createTextFromYoutube } from "../youtube-actions";
import type { CreateTextState } from "../actions";
import PaywallNotice from "./paywall-notice";

export default function YoutubeImportForm() {
  const [state, formAction, pending] = useActionState<CreateTextState, FormData>(
    createTextFromYoutube,
    {},
  );

  if (state.paywall) {
    return <PaywallNotice />;
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4 px-5 py-6">
      <input
        type="url"
        name="url"
        required
        placeholder="https://www.youtube.com/watch?v=…"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <p className="text-sm text-black/50 dark:text-white/50">
        Работает только для видео с открытыми субтитрами — вытащим их и уберём таймкоды.
      </p>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? "Загружаем…" : "Импортировать субтитры"}
      </button>
    </form>
  );
}
