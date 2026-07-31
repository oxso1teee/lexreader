"use client";

import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "./actions";

export default function FeedbackForm() {
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});

  return (
    <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
      <h2 className="mb-2 font-medium">Обратная связь</h2>
      {state.ok ? (
        <p className="text-sm text-black/60 dark:text-white/60">Спасибо, получили ✓</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <textarea
            name="message"
            required
            rows={3}
            placeholder="Что можно улучшить?"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
          />
          {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {pending ? "Отправляем…" : "Отправить"}
          </button>
        </form>
      )}
    </section>
  );
}
