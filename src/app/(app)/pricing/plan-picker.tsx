"use client";

import { useState } from "react";
import CheckoutButton from "./checkout-button";

type Plan = "premium_monthly" | "premium_yearly";

const PLANS: { value: Plan; name: string; price: string; save?: string }[] = [
  { value: "premium_yearly", name: "Год", price: "374 ₽/мес", save: "−17%" },
  { value: "premium_monthly", name: "Месяц", price: "449 ₽/мес" },
];

// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 4.4: один блок
// с переключателем план/год внутри вместо двух конкурирующих карточек-тарифа.
export default function PlanPicker({
  stripeReady,
  simulateMonthly,
  simulateYearly,
}: {
  stripeReady: boolean;
  simulateMonthly: () => Promise<void>;
  simulateYearly: () => Promise<void>;
}) {
  const [plan, setPlan] = useState<Plan>("premium_yearly");

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {PLANS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPlan(p.value)}
            aria-pressed={plan === p.value}
            className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
              plan === p.value
                ? "border-accent bg-accent-soft"
                : "border-black/10 dark:border-white/15"
            }`}
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              {p.name}
              {p.save && <span className="text-xs font-bold text-success">{p.save}</span>}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums">{p.price}</span>
          </button>
        ))}
      </div>

      {stripeReady ? (
        <CheckoutButton
          plan={plan}
          label="Оформить Premium"
          className="w-full rounded-full bg-well py-3 font-semibold text-white"
        />
      ) : (
        <form action={plan === "premium_yearly" ? simulateYearly : simulateMonthly}>
          <button type="submit" className="w-full rounded-full bg-well py-3 font-semibold text-white">
            Оформить Premium
          </button>
        </form>
      )}
    </div>
  );
}
