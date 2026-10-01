"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setNewPassword, type SetPasswordState } from "./actions";
import { Button } from "@/components/ui/button";

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
      <p className="text-sm text-[var(--color-success-text)]">
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
        className="w-full rounded-lg border border-[var(--border-strong)] px-4 py-2.5 text-base outline-none focus:border-[var(--color-forest)]"
      />
      <input
        type="password"
        name="confirmPassword"
        required
        minLength={6}
        placeholder="Повтори пароль"
        className="w-full rounded-lg border border-[var(--border-strong)] px-4 py-2.5 text-base outline-none focus:border-[var(--color-forest)]"
      />
      {state.error && <p className="text-sm text-[var(--color-danger-text)]">{state.error}</p>}
      <Button type="submit" variant="leaf" disabled={pending}>
        {pending ? "Сохраняем…" : "Сохранить новый пароль"}
      </Button>
    </form>
  );
}
