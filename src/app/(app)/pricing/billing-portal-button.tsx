"use client";

import { useActionState } from "react";
import { createBillingPortalSession, type CheckoutState } from "./actions";
import { useIsNativePlatform } from "@/lib/use-is-native";

export default function BillingPortalButton() {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    createBillingPortalSession,
    {},
  );
  const isNative = useIsNativePlatform();

  // см. src/lib/use-is-native.ts — управление подпиской в v1 обёртки
  // доступно только на сайте, не внутри нативного приложения.
  if (isNative) {
    return (
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        Управление подпиской и оплатой — на сайте LexReader в браузере.
      </p>
    );
  }

  return (
    <form action={formAction} className="mt-3">
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-[var(--text-secondary)] underline hover:text-[var(--foreground)] disabled:opacity-50"
      >
        {pending ? "…" : "Управление подпиской и оплатой"}
      </button>
      {state.error && <p className="mt-2 text-sm text-[var(--color-danger-text)]">{state.error}</p>}
    </form>
  );
}
