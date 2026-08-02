"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { login, type LoginState } from "./actions";
import RateLimitNotice from "@/components/rate-limit-notice";

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
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <input
        type="password"
        name="password"
        required
        placeholder="Пароль"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
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
        {pending ? "Входим…" : "Войти"}
      </button>
      {/* Отдельный бакет от login (auth-rate-limit.ts) — блокировка входа не
          должна мешать перейти к сбросу пароля. */}
      <Link href="/reset-password" className="text-center text-sm text-black/50 underline dark:text-white/50">
        Забыл пароль?
      </Link>
    </form>
  );
}
