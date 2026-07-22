import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { simulateSubscribe, cancelSimulatedSubscription } from "./actions";

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

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-5 py-8">
      <div>
        <Link href="/home" className="text-sm font-medium text-caramel">
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
          <form action={cancelSimulatedSubscription} className="mt-3">
            <button
              type="submit"
              className="text-sm text-black/50 underline hover:text-black dark:text-white/50 dark:hover:text-white"
            >
              Отменить (тестовый режим)
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-card p-5 shadow-sm">
            <h2 className="text-lg font-bold">LexReader Premium — Ежемесячно</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              Полный доступ ко всем премиум-функциям
            </p>
            <p className="mt-3">
              <span className="text-3xl font-bold text-caramel">449 ₽</span>
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
            <form action={simulateSubscribe.bind(null, "premium_monthly")} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-full border-2 border-caramel py-3 font-semibold text-caramel"
              >
                Начать
              </button>
            </form>
          </div>

          <div className="relative rounded-2xl border-2 border-caramel bg-card p-5 shadow-sm">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-caramel px-3 py-1 text-xs font-bold tracking-wide text-white uppercase">
              Популярный
            </span>
            <h2 className="mt-1 text-lg font-bold">LexReader Premium — Ежегодно</h2>
            <p className="text-sm text-black/60 dark:text-white/60">
              Полный доступ ко всем премиум-функциям
            </p>
            <p className="mt-3">
              <span className="text-3xl font-bold text-caramel">4490 ₽</span>
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
            <form action={simulateSubscribe.bind(null, "premium_yearly")} className="mt-4">
              <button
                type="submit"
                className="w-full rounded-full bg-caramel py-3 font-semibold text-white"
              >
                Начать
              </button>
            </form>
          </div>

          <p className="text-xs text-black/40 dark:text-white/40">
            Это тестовая кнопка локальной разработки — она не проводит реальную оплату, а просто
            помечает подписку активной в базе. Настоящая оплата подключается позже через
            RevenueCat + App Store / Google Play, когда будут готовы аккаунты разработчика в этих
            сервисах.
          </p>
        </>
      )}
    </div>
  );
}
