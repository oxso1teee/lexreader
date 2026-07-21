import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { getPlan } from "@/lib/subscription";
import { simulateSubscribe, cancelSimulatedSubscription } from "./actions";

const REASONS: Record<string, string> = {
  texts: "Ты держишь максимум текстов на бесплатном тарифе.",
  words: "Ты сохранил максимум слов на сегодня по бесплатному тарифу.",
};

const BENEFITS = [
  "Безлимит текстов и слов",
  "Импорт по ссылке и из YouTube",
  "Контекстный AI-перевод идиом и фразовых глаголов",
  "Фото на карточках слов",
  "Расширенная статистика",
];

export default async function PaywallPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  const plan = await getPlan(supabase, profile!.id);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
      <div>
        <h1 className="text-2xl font-semibold">LexReader Premium</h1>
        {reason && REASONS[reason] && (
          <p className="mt-1 text-black/60 dark:text-white/60">{REASONS[reason]}</p>
        )}
      </div>

      {plan !== "free" ? (
        <div className="rounded-lg border border-black/10 px-4 py-4 dark:border-white/15">
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
          <ul className="flex flex-col gap-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-black/80 dark:text-white/80">
                <span>✓</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-3">
            <form action={simulateSubscribe.bind(null, "premium_yearly")}>
              <button
                type="submit"
                className="w-full rounded-lg bg-black px-5 py-4 text-left text-white dark:bg-white dark:text-black"
              >
                <span className="block font-semibold">Годовая — 4490 ₽/год</span>
                <span className="block text-sm opacity-70">≈ 374 ₽/мес, экономия 17%</span>
              </button>
            </form>
            <form action={simulateSubscribe.bind(null, "premium_monthly")}>
              <button
                type="submit"
                className="w-full rounded-lg border border-black/10 px-5 py-4 text-left dark:border-white/15"
              >
                <span className="block font-semibold">Месячная — 449 ₽/мес</span>
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
