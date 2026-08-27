"use client";

import { useActionState } from "react";
import { createCheckoutSession, type CheckoutState } from "./actions";
import { useIsNativePlatform } from "@/lib/use-is-native";

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
  const isNative = useIsNativePlatform();

  // см. src/lib/use-is-native.ts — v1 мобильной обёртки не показывает
  // покупку подписки внутри самого приложения вообще.
  if (isNative) {
    return <p className="text-sm text-black/50 dark:text-white/50">Оформление подписки доступно на сайте LexReader в браузере.</p>;
  }

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending} className={className}>
        {pending ? "…" : label}
      </button>
      {state.error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
