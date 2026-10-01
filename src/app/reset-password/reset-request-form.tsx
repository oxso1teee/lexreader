"use client";

import { useActionState, useState } from "react";
import { requestPasswordReset, type ResetRequestState } from "./actions";
import RateLimitNotice from "@/components/rate-limit-notice";
import { Button } from "@/components/ui/button";

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
      <p className="text-sm text-[var(--text-secondary)]">
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
        className="w-full rounded-lg border border-[var(--border-strong)] px-4 py-2.5 text-base outline-none focus:border-[var(--color-forest)]"
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
          <p role="alert" className="text-sm text-[var(--color-danger-text)]">
            {state.error}
          </p>
        )
      )}
      <Button type="submit" variant="leaf" disabled={pending || blocked}>
        {pending ? "Отправляем…" : "Отправить ссылку для сброса"}
      </Button>
    </form>
  );
}
