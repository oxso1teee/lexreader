import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { IconCheck } from "@/components/icons";
import { simulateSubscribe, cancelSimulatedSubscription } from "./actions";
import PlanPicker from "./plan-picker";
import BillingPortalButton from "./billing-portal-button";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

const REASONS: Record<string, string> = {
  texts: "Ты держишь максимум текстов на бесплатном тарифе.",
  words: "Ты сохранил максимум слов на сегодня по бесплатному тарифу.",
};

const FEATURES = [
  "Безлимитные тексты",
  "Импорт по ссылке, YouTube и фото",
  "Контекстный ИИ-перевод идиом и фразовых глаголов",
  "Режим прослушивания с озвучкой",
  "Карточки с интервальным повторением без ограничений",
  "Фото на карточках слов",
  "Расширенная статистика",
  "Приоритетная поддержка",
];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const profile = await requireProfile();
  const supabase = await createClient();
  const plan = await getPlan(supabase, profile.id);
  const stripeReady = isStripeConfigured();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_customer_id")
    .eq("owner_id", profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <div>
        <Link href="/home" className="text-sm font-medium text-accent-strong">
          ← Назад
        </Link>
        <h1 className="mt-2 text-2xl font-bold">LexReader Premium</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Учись быстрее — без ограничений
        </p>
        {reason && REASONS[reason] && (
          <p className="mt-2 text-sm text-warning">{REASONS[reason]}</p>
        )}
      </div>

      {plan !== "free" ? (
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <p className="font-medium">
            У тебя активна подписка: {plan === "premium_yearly" ? "годовая" : "месячная"}
          </p>
          {subscription?.status === "past_due" && (
            <p className="mt-1 text-sm text-warning">
              Последнее списание не прошло — обнови способ оплаты, доступ сохранится ещё
              некоторое время.
            </p>
          )}
          {subscription?.current_period_end && (
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              {subscription.status === "past_due" ? "Доступ до" : "Продление"}:{" "}
              {formatDate(subscription.current_period_end)}
            </p>
          )}
          {subscription?.stripe_customer_id ? (
            <BillingPortalButton />
          ) : (
            <form action={cancelSimulatedSubscription} className="mt-3">
              <button
                type="submit"
                className="text-sm text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
              >
                Отменить (тестовый режим)
              </button>
            </form>
          )}
        </div>
      ) : (
        <>
          {!stripeReady && (
            <div className="rounded-2xl border border-warning bg-warning-soft p-4 text-sm text-black/80 dark:text-white/80">
              <p className="font-semibold">Бета-тестирование: Premium сейчас бесплатно</p>
              <p className="mt-1">
                Оплата ещё не подключена — оформление ниже даст полный доступ без списания денег.
                Цены — то, что будет после запуска настоящей оплаты, сейчас они не действуют.
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <p className="text-sm text-black/60 dark:text-white/60">
              Полный доступ ко всем премиум-функциям
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                    <IconCheck className="h-3 w-3" />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <PlanPicker
              stripeReady={stripeReady}
              simulateMonthly={simulateSubscribe.bind(null, "premium_monthly")}
              simulateYearly={simulateSubscribe.bind(null, "premium_yearly")}
            />
          </div>

          <p className="text-xs text-black/40 dark:text-white/40">
            {stripeReady
              ? "Оплата через Stripe Checkout — карта не сохраняется в LexReader, всё проходит на стороне Stripe."
              : "Это тестовая кнопка локальной разработки — она не проводит реальную оплату, а просто помечает подписку активной в базе. Настоящая оплата подключается через Stripe, когда будут заданы STRIPE_SECRET_KEY/STRIPE_PRICE_MONTHLY/STRIPE_PRICE_YEARLY."}
          </p>
          <p className="text-xs text-black/40 dark:text-white/40">
            Оформляя подписку, ты соглашаешься с{" "}
            <Link href="/terms" className="underline">
              условиями использования
            </Link>{" "}
            и{" "}
            <Link href="/privacy" className="underline">
              политикой конфиденциальности
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
