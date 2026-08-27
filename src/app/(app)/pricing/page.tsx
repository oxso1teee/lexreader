import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { simulateSubscribe, cancelSimulatedSubscription } from "./actions";
import CheckoutButton from "./checkout-button";
import BillingPortalButton from "./billing-portal-button";
import PricingFaq from "./pricing-faq";
import PricingViewTracker from "./pricing-view-tracker";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${d.getFullYear()}`;
}

const REASONS: Record<string, string> = {
  texts: "Ты держишь максимум текстов на бесплатном тарифе.",
  words: "Ты сохранил максимум слов на сегодня по бесплатному тарифу.",
  // M3 Slice 4 §12: decks/cards уже отправлялись сюда из Мозга
  // (new-deck-modal.tsx, add-card-form.tsx) — просто не было текста для них,
  // так что переход с paywall на pricing ничего не объяснял.
  decks: "Ты создал максимум колод на бесплатном тарифе.",
  cards: "Ты сохранил максимум карточек на бесплатном тарифе.",
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
  // Раздел 5 промта 2026-07-30 (запуск): раньше баннер "Бета: Premium
  // бесплатно" и тестовая кнопка симуляции показывались всегда, когда Stripe
  // не настроен — в том числе если ключ случайно не задан в реальном проде.
  // Теперь в реальном проде при неготовом Stripe показываем нейтральное
  // "недоступно" вместо тестового пути, а не тихо пускаем "покупку" мимо
  // настоящей оплаты.
  const isRealProduction = process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production";
  const showDevSimulation = !stripeReady && !isRealProduction;
  const showUnavailable = !stripeReady && isRealProduction;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end, stripe_customer_id")
    .eq("owner_id", profile.id)
    .maybeSingle();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <PricingViewTracker reason={reason} />
      <div>
        <Link href="/home" className="text-sm font-medium text-forest">
          ← Назад
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Выберите ваш план</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Разблокируйте все премиум-функции и ускорьте изучение языка
        </p>
        {reason && REASONS[reason] && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{REASONS[reason]}</p>
        )}
      </div>

      {plan !== "free" ? (
        <div className="rounded-2xl bg-card p-5 shadow-sm">
          <p className="font-medium">
            У тебя активна подписка: {plan === "premium_yearly" ? "годовая" : "месячная"}
          </p>
          {subscription?.status === "past_due" && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
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
          {showDevSimulation && (
            <div className="rounded-2xl border-2 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold">🎁 Бета-тестирование: Premium сейчас бесплатно</p>
              <p className="mt-1">
                Оплата ещё не подключена — нажатие «Начать» ниже даст полный доступ без списания
                денег. Цены на карточках — то, что будет после запуска настоящей оплаты, сейчас
                они не действуют.
              </p>
            </div>
          )}
          {showUnavailable && (
            <div className="rounded-2xl border border-black/10 bg-card p-4 text-sm text-black/60 dark:border-white/15 dark:text-white/60">
              Оплата временно недоступна — попробуй чуть позже.
            </div>
          )}
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold">LexReader Premium — Ежемесячно</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              Полный доступ ко всем премиум-функциям
            </p>
            <p className="mt-3">
              <span className="text-3xl font-bold text-forest">449 ₽</span>
              <span className="text-black/50 dark:text-white/50"> /месяц</span>
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {stripeReady ? (
              <div className="mt-4">
                <CheckoutButton
                  plan="premium_monthly"
                  label="Начать — 3 дня бесплатно"
                  className="w-full rounded-full border-2 border-forest py-3 font-semibold text-forest"
                />
              </div>
            ) : showDevSimulation ? (
              <form action={simulateSubscribe.bind(null, "premium_monthly")} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-full border-2 border-forest py-3 font-semibold text-forest"
                >
                  Начать
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-full border-2 border-black/10 py-3 font-semibold text-black/30 dark:border-white/15 dark:text-white/30"
              >
                Временно недоступно
              </button>
            )}
          </div>

          <div className="relative rounded-2xl border-2 border-forest bg-card p-5 shadow-sm">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-forest px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
              Популярный
            </span>
            <h2 className="mt-1 text-lg font-bold">LexReader Premium — Ежегодно</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              Полный доступ ко всем премиум-функциям
            </p>
            <p className="mt-3">
              <span className="text-3xl font-bold text-forest">4490 ₽</span>
              <span className="text-black/50 dark:text-white/50"> /год</span>
            </p>
            <p className="text-sm text-black/50 dark:text-white/50">
              ≈ 374 ₽/мес, экономия 17%
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {stripeReady ? (
              <div className="mt-4">
                <CheckoutButton
                  plan="premium_yearly"
                  label="Начать — 3 дня бесплатно"
                  className="w-full rounded-full bg-forest py-3 font-semibold text-white"
                />
              </div>
            ) : showDevSimulation ? (
              <form action={simulateSubscribe.bind(null, "premium_yearly")} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-full bg-forest py-3 font-semibold text-white"
                >
                  Начать
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled
                className="mt-4 w-full rounded-full bg-black/10 py-3 font-semibold text-black/30 dark:bg-white/10 dark:text-white/30"
              >
                Временно недоступно
              </button>
            )}
          </div>

          <PricingFaq />

          {!showUnavailable && (
            <p className="text-xs text-black/40 dark:text-white/40">
              {stripeReady
                ? "Оплата через Stripe Checkout — карта не сохраняется в LexReader, всё проходит на стороне Stripe."
                : "Это тестовая кнопка локальной разработки — она не проводит реальную оплату, а просто помечает подписку активной в базе. Настоящая оплата подключается через Stripe, когда будут заданы STRIPE_SECRET_KEY/STRIPE_PRICE_MONTHLY/STRIPE_PRICE_YEARLY."}
            </p>
          )}
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
