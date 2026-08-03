// Отдельная копия от src/app/(app)/pricing/page.tsx намеренно — не трогаем
// файлы с реальной Stripe-интеграцией в этом слайсе (задача: "не менять
// Stripe integration"), а тривиальное форматирование даты не стоит того,
// чтобы ради переиспользования модифицировать pricing-код.
export function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

export type Plan = "free" | "premium_monthly" | "premium_yearly";

export function planLabel(plan: Plan): string {
  if (plan === "premium_monthly") return "Premium (месяц)";
  if (plan === "premium_yearly") return "Premium (год)";
  return "Бесплатный";
}

export interface SubscriptionPeriodInfo {
  label: "Продление" | "Доступ до";
  formattedDate: string;
}

// subscriptions.current_period_end может пережить саму подписку (строка не
// удаляется при отмене) — getPlan() уже правильно вернул бы "free" в этом
// случае, но наивно проверять только periodEnd!==null показало бы дату
// продления рядом с "Бесплатный". Показываем её только вместе с реально
// активным платным планом — то же условие, что уже есть на /pricing.
export function subscriptionPeriodInfo(
  plan: Plan,
  status: string | null,
  periodEnd: string | null,
): SubscriptionPeriodInfo | null {
  if (plan === "free" || !periodEnd) return null;
  return {
    label: status === "past_due" ? "Доступ до" : "Продление",
    formattedDate: formatDate(periodEnd),
  };
}

export function showPastDueWarning(plan: Plan, status: string | null): boolean {
  return plan !== "free" && status === "past_due";
}
