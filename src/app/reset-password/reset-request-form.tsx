"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type ResetRequestState } from "./actions";
import RateLimitNotice from "@/components/rate-limit-notice";

export default function ResetRequestForm() {
  const [state, formAction, pending] = useActionState<ResetRequestState, FormData>(
    requestPasswordReset,
    {},
  );
  const [blocked, setBlocked] = useState(false);
  const [prevRetryAfterSeconds, setPrevRetryAfterSeconds] = useState(state.retryAfterSeconds);
  if (state.retryAfterSeconds !== prevRetryAfterSeconds) {
    setPrevRetryAfterSeconds(state.retryAfterSeconds);
    setBlocked(Boolean(state.retryAfterSeconds));
  }

  if (state.submitted) {
    return (
      <p className="text-sm text-black/70 dark:text-white/70">
        Если такой email зарегистрирован, мы отправили на него письмо со ссылкой для сброса
        пароля. Проверь почту (и папку «Спам»).
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="email"
        name="email"
        required
        placeholder="Email"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      {blocked && state.retryAfterSeconds ? (
        <RateLimitNotice
          key={state.retryAfterSeconds}
          message={state.error ?? "Слишком много запросов на сброс пароля."}
          retryAfterSeconds={state.retryAfterSeconds}
          onExpire={() => setBlocked(false)}
        />
      ) : (
        state.error &&
        !state.retryAfterSeconds && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.error}
          </p>
        )
      )}
      <button
        type="submit"
        disabled={pending || blocked}
        className="rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? "Отправляем…" : "Отправить ссылку для сброса"}
      </button>
    </form>
  );
}
