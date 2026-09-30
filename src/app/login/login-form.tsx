"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";
import RateLimitNotice from "@/components/rate-limit-notice";
import { Button } from "@/components/ui/button";

export default function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [blocked, setBlocked] = useState(false);
  // "Adjusting state when a prop changes" (react.dev) — сравнение в теле
  // рендера вместо useEffect, чтобы не ловить set-state-in-effect и не
  // терять кадр на лишний ререндер при каждом новом ответе сервера.
  const [prevRetryAfterSeconds, setPrevRetryAfterSeconds] = useState(state.retryAfterSeconds);
  if (state.retryAfterSeconds !== prevRetryAfterSeconds) {
    setPrevRetryAfterSeconds(state.retryAfterSeconds);
    setBlocked(Boolean(state.retryAfterSeconds));
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-4">
      <input
        type="email"
        name="email"
        required
        placeholder="Email"
        className="w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-4 py-2.5 text-base outline-none focus:border-[var(--color-forest)]"
      />
      <input
        type="password"
        name="password"
        required
        placeholder="Пароль"
        className="w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-4 py-2.5 text-base outline-none focus:border-[var(--color-forest)]"
      />
      {blocked && state.retryAfterSeconds ? (
        <RateLimitNotice
          key={state.retryAfterSeconds}
          message={state.error ?? "Слишком много попыток входа."}
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
        {pending ? "Входим…" : "Войти"}
      </Button>
      {/* Отдельный бакет от login (auth-rate-limit.ts) — блокировка входа не
          должна мешать перейти к сбросу пароля. */}
      <Link href="/reset-password" className="text-center text-sm text-[var(--text-secondary)] underline">
        Забыл пароль?
      </Link>
    </form>
  );
}
