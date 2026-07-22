"use client";

import { useActionState } from "react";
import { createBillingPortalSession, type CheckoutState } from "./actions";

export default function BillingPortalButton() {
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(
    createBillingPortalSession,
    {},
  );

  return (
    <form action={formAction} className="mt-3">
      <button
        type="submit"
        disabled={pending}
        className="text-sm text-black/50 underline hover:text-black disabled:opacity-50 dark:text-white/50 dark:hover:text-white"
      >
        {pending ? "…" : "Управление подпиской и оплатой"}
      </button>
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
