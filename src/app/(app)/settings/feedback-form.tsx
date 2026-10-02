"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { sendFeedback, type FeedbackState } from "./actions";

export default function FeedbackForm() {
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(sendFeedback, {});

  return (
    <section className="rounded-2xl bg-[var(--surface)] p-4">
      <h2 className="text-h3 mb-2">Обратная связь</h2>
      {state.ok ? (
        <p role="status" className="inline-flex items-center gap-1 text-body-sm text-[var(--color-success)]">
          Спасибо, получили <Check aria-hidden="true" className="h-4 w-4" />
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-2">
          <label htmlFor="feedback-message" className="sr-only">
            Что можно улучшить?
          </label>
          <textarea
            id="feedback-message"
            name="message"
            required
            rows={3}
            placeholder="Что можно улучшить?"
            className="focus-ring w-full rounded-lg border border-[var(--border-strong)] px-3 py-2 text-body-sm"
          />
          {state.error && (
            <p role="alert" className="text-body-sm text-[var(--color-danger-text)]">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="focus-ring flex min-h-11 items-center self-start rounded-full bg-forest px-4 text-body-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Отправляем…" : "Отправить"}
          </button>
        </form>
      )}
    </section>
  );
}
