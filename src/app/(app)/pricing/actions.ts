"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireProfile } from "@/lib/auth";
import type { Plan } from "@/lib/subscription";
import { getStripeClient, isStripeConfigured, STRIPE_PRICE_IDS } from "@/lib/stripe";
import { siteUrl } from "@/lib/site-url";

export interface CheckoutState {
  error?: string;
}

// Реальная оплата через Stripe Checkout — требует, чтобы владелец продукта
// сам завёл Stripe-аккаунт, создал два recurring Price (месяц/год) и задал
// STRIPE_SECRET_KEY/STRIPE_PRICE_MONTHLY/STRIPE_PRICE_YEARLY. Без этого
// показываем понятную ошибку, а не падаем — см. isStripeConfigured().
export async function createCheckoutSession(
  plan: Extract<Plan, "premium_monthly" | "premium_yearly">,
): Promise<CheckoutState> {
  if (!isStripeConfigured()) {
    return { error: "Оплата ещё не настроена — обратись к администратору." };
  }

  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    return { error: "Тарифный план временно недоступен." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Не авторизован." };

  const stripe = getStripeClient();

  // P0-АУДИТ (раздел 4): вызовы Stripe API ничем не были защищены — сбой
  // (сетевой, временная недоступность Stripe) падал необработанным
  // исключением вместо понятной ошибки на странице (для этого и есть
  // CheckoutState.error). redirect() — вне try, у него своя throw-механика.
  let checkoutUrl: string | null;
  try {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("owner_id", profile.id)
      .maybeSingle();

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { owner_id: profile.id },
      });
      customerId = customer.id;
      // Запись в subscriptions разрешена только service_role (P0-АУДИТ 2.1) —
      // обычный RLS-клиент теперь не может писать в эту таблицу вообще.
      await createServiceClient()
        .from("subscriptions")
        .upsert({ owner_id: profile.id, stripe_customer_id: customerId }, { onConflict: "owner_id" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: profile.id,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      // Раздел 5 промта 2026-07-30 (запуск): 3 дня бесплатно снижают трение
      // первой оплаты — карта привязывается сразу, списание только после
      // пробного периода.
      subscription_data: { trial_period_days: 3 },
      success_url: `${siteUrl()}/library?checkout=success`,
      cancel_url: `${siteUrl()}/pricing?checkout=cancelled`,
    });
    checkoutUrl = session.url;
  } catch {
    return { error: "Не удалось создать сессию оплаты. Попробуй ещё раз." };
  }

  if (!checkoutUrl) return { error: "Не удалось создать сессию оплаты." };
  redirect(checkoutUrl);
}

// Redirect в Stripe Customer Portal — управление способом оплаты, отмена,
// история счетов. Требует настроенного Customer Portal в Stripe Dashboard.
export async function createBillingPortalSession(): Promise<CheckoutState> {
  if (!isStripeConfigured()) {
    return { error: "Оплата ещё не настроена — обратись к администратору." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (!data?.stripe_customer_id) {
    return { error: "Активной подписки не найдено." };
  }

  let portalUrl: string;
  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${siteUrl()}/pricing`,
    });
    portalUrl = session.url;
  } catch {
    return { error: "Не удалось открыть управление подпиской. Попробуй ещё раз." };
  }

  redirect(portalUrl);
}

// Локальная заглушка для тестирования лимитов без реальной оплаты.
// Настоящая оплата подписки идёт через RevenueCat + Apple StoreKit / Google
// Billing (раздел 8 ТЗ) — для этого нужны отдельные аккаунты разработчика
// (Apple Developer Program, Google Play Console, RevenueCat), которые может
// завести только сам пользователь. Здесь их нет и не будет — эта кнопка
// только пишет статус подписки в БД для локальной разработки.
//
// P0-АУДИТ 2.2: раньше эта функция не проверяла isStripeConfigured() и была
// вызываемой напрямую (Server Action — отдельная конечная точка) даже когда
// в интерфейсе показывалась кнопка настоящей оплаты. Плюс писала через
// RLS-клиент — после сужения RLS (2.1) это и не сработало бы. Теперь: явно
// не работает при настоящем Stripe, и пишет через service_role.
export async function simulateSubscribe(plan: Extract<Plan, "premium_monthly" | "premium_yearly">) {
  if (isStripeConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await createServiceClient()
    .from("subscriptions")
    .upsert({
      owner_id: user.id,
      plan,
      status: "active",
      provider: "stripe",
      current_period_end: new Date(
        Date.now() + (plan === "premium_yearly" ? 365 : 30) * 86_400_000,
      ).toISOString(),
    });

  revalidatePath("/library");
  revalidatePath("/paywall");
  redirect("/library");
}

export async function cancelSimulatedSubscription() {
  if (isStripeConfigured()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await createServiceClient()
    .from("subscriptions")
    .update({ status: "canceled" })
    .eq("owner_id", user.id);
  revalidatePath("/paywall");
}
