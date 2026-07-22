"use client";

import { useActionState } from "react";
import { createCheckoutSession, type CheckoutState } from "./actions";

export default function CheckoutButton({
  plan,
  label,
  className,
}: {
  plan: "premium_monthly" | "premium_yearly";
  label: string;
  className: string;
}) {
  const action = createCheckoutSession.bind(null, plan);
  const [state, formAction, pending] = useActionState<CheckoutState, FormData>(action, {});

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} className={className}>
        {pending ? "…" : label}
      </button>
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
