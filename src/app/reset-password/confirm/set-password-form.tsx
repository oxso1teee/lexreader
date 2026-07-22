"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setNewPassword, type SetPasswordState } from "./actions";

export default function SetPasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<SetPasswordState, FormData>(
    setNewPassword,
    {},
  );

  useEffect(() => {
    if (state.success) {
      const timer = setTimeout(() => router.push("/login"), 1500);
      return () => clearTimeout(timer);
    }
  }, [state.success, router]);

  if (state.success) {
    return (
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        Пароль обновлён — переходим на вход…
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input
        type="password"
        name="password"
        required
        minLength={6}
        placeholder="Новый пароль (мин. 6 символов)"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      <input
        type="password"
        name="confirmPassword"
        required
        minLength={6}
        placeholder="Повтори пароль"
        className="w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 dark:border-white/15 dark:focus:border-white/40"
      />
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-black px-5 py-3 font-medium text-white transition-colors hover:bg-black/80 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/80"
      >
        {pending ? "Сохраняем…" : "Сохранить новый пароль"}
      </button>
    </form>
  );
}
