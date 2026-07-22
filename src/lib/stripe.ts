import Stripe from "stripe";

// Требует реального Stripe-аккаунта пользователя (создать самому: dashboard →
// Developers → API keys) — без STRIPE_SECRET_KEY функции ниже не вызываются,
// вызывающий код должен сам проверять isStripeConfigured() и показывать
// понятное сообщение вместо падения.
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY не задан — оплата ещё не настроена.");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

// ID цен создаются в Stripe Dashboard → Product catalog (recurring price,
// monthly/yearly) владельцем аккаунта — их нельзя сгенерировать программно
// без реального Stripe-аккаунта.
export const STRIPE_PRICE_IDS = {
  premium_monthly: process.env.STRIPE_PRICE_MONTHLY,
  premium_yearly: process.env.STRIPE_PRICE_YEARLY,
} as const;

// Обратная карта price_id -> наш внутренний план, для разбора вебхуков.
export function planFromPriceId(priceId: string | null | undefined): "premium_monthly" | "premium_yearly" | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICE_IDS.premium_monthly) return "premium_monthly";
  if (priceId === STRIPE_PRICE_IDS.premium_yearly) return "premium_yearly";
  return null;
}
