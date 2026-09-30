import Link from "next/link";
import { Check, Gift } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { isStripeConfigured } from "@/lib/stripe";
import { simulateSubscribe, cancelSimulatedSubscription } from "./actions";
import CheckoutButton from "./checkout-button";
import BillingPortalButton from "./billing-portal-button";
import PricingFaq from "./pricing-faq";
import PricingViewTracker from "./pricing-view-tracker";
import { buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
        {/* forest-text-contrast-fix: text-forest -> --color-forest-text
            (see progress/stat-card.tsx). */}
        <Link href="/home" className="text-sm font-medium text-[var(--color-forest-text)]">
          ← Назад
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Выберите ваш план</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Разблокируйте все премиум-функции и ускорьте изучение языка
        </p>
        {reason && REASONS[reason] && (
          <p className="mt-2 text-sm text-[var(--color-warning-text)]">{REASONS[reason]}</p>
        )}
      </div>

      {plan !== "free" ? (
        <Card className="p-5">
          <p className="font-medium">
            У тебя активна подписка: {plan === "premium_yearly" ? "годовая" : "месячная"}
          </p>
          {subscription?.status === "past_due" && (
            <p className="mt-1 text-sm text-[var(--color-warning-text)]">
              Последнее списание не прошло — обнови способ оплаты, доступ сохранится ещё
              некоторое время.
            </p>
          )}
          {subscription?.current_period_end && (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
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
                className="text-sm text-[var(--text-secondary)] underline hover:text-[var(--foreground)]"
              >
                Отменить (тестовый режим)
              </button>
            </form>
          )}
        </Card>
      ) : (
        <>
          {showDevSimulation && (
            <div className="rounded-2xl border-2 border-[var(--color-warning)] bg-[var(--ember-tint)] p-4 text-sm">
              <p className="flex items-center gap-1.5 font-semibold text-[var(--color-warning-text)]">
                <Gift aria-hidden="true" className="h-4 w-4 shrink-0" />
                Бета-тестирование: Premium сейчас бесплатно
              </p>
              <p className="mt-1">
                Оплата ещё не подключена — нажатие «Начать» ниже даст полный доступ без списания
                денег. Цены на карточках — то, что будет после запуска настоящей оплаты, сейчас
                они не действуют.
              </p>
            </div>
          )}
          {showUnavailable && (
            <Card className="text-sm text-[var(--text-secondary)]">
              Оплата временно недоступна — попробуй чуть позже.
            </Card>
          )}
          <Card className="p-5">
            <h2 className="text-lg font-bold">LexReader Premium — Ежемесячно</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Полный доступ ко всем премиум-функциям
            </p>
            <p className="mt-3">
              <span className="text-3xl font-bold text-[var(--color-forest-text)]">449 ₽</span>
              <span className="text-[var(--text-secondary)]"> /месяц</span>
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success-text)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {/* forest-text-contrast-fix: text-forest measured ~1.7:1 against
                bg-card in dark (same failure as progress/stat-card.tsx) --
                --color-forest-text keeps the secondary plan's label readable
                on the ghost fill. Only the label is forest-tinted. */}
            {stripeReady ? (
              <div className="mt-4">
                <CheckoutButton
                  plan="premium_monthly"
                  label="Начать — 3 дня бесплатно"
                  className={buttonClassName({ variant: "ghost", className: "w-full text-[var(--color-forest-text)]" })}
                />
              </div>
            ) : showDevSimulation ? (
              <form action={simulateSubscribe.bind(null, "premium_monthly")} className="mt-4">
                <button
                  type="submit"
                  className={buttonClassName({ variant: "ghost", className: "w-full text-[var(--color-forest-text)]" })}
                >
                  Начать
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled
                className={buttonClassName({ variant: "ghost", className: "mt-4 w-full" })}
              >
                Временно недоступно
              </button>
            )}
          </Card>

          <Card className="relative border-forest p-5">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-forest px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
              Популярный
            </span>
            <h2 className="mt-1 text-lg font-bold">LexReader Premium — Ежегодно</h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Полный доступ ко всем премиум-функциям
            </p>
            <p className="mt-3">
              <span className="text-3xl font-bold text-[var(--color-forest-text)]">4490 ₽</span>
              <span className="text-[var(--text-secondary)]"> /год</span>
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              ≈ 374 ₽/мес, экономия 17%
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success-text)]" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            {stripeReady ? (
              <div className="mt-4">
                <CheckoutButton
                  plan="premium_yearly"
                  label="Начать — 3 дня бесплатно"
                  className={buttonClassName({ variant: "leaf", className: "w-full" })}
                />
              </div>
            ) : showDevSimulation ? (
              <form action={simulateSubscribe.bind(null, "premium_yearly")} className="mt-4">
                <button
                  type="submit"
                  className={buttonClassName({ variant: "leaf", className: "w-full" })}
                >
                  Начать
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled
                className={buttonClassName({ variant: "ghost", className: "mt-4 w-full" })}
              >
                Временно недоступно
              </button>
            )}
          </Card>

          <PricingFaq />

          {!showUnavailable && (
            <p className="text-xs text-[var(--text-secondary)]">
              {stripeReady
                ? "Оплата через Stripe Checkout — карта не сохраняется в LexReader, всё проходит на стороне Stripe."
                : "Это тестовая кнопка локальной разработки — она не проводит реальную оплату, а просто помечает подписку активной в базе. Настоящая оплата подключается через Stripe, когда будут заданы STRIPE_SECRET_KEY/STRIPE_PRICE_MONTHLY/STRIPE_PRICE_YEARLY."}
            </p>
          )}
          <p className="text-xs text-[var(--text-secondary)]">
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
