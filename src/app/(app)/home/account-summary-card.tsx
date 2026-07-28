import Link from "next/link";

// Идея из разбора конкурента (скрины Lexpring, 2026-07-28): на Главной
// постоянно (не только первые 7 дней, как WelcomeCard) видно, под каким
// аккаунтом вошли и сколько уже накоплено — почта, план, слов в тетради,
// текстов в библиотеке.
export default function AccountSummaryCard({
  email,
  plan,
  wordCount,
  textCount,
}: {
  email: string;
  plan: "free" | "premium_monthly" | "premium_yearly";
  wordCount: number;
  textCount: number;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">LexReader</span>
          {plan !== "free" && (
            <span className="rounded-full bg-caramel px-2 py-0.5 text-xs font-semibold text-white">
              Premium
            </span>
          )}
        </div>
        <Link
          href="/settings"
          className="text-xs text-black/40 underline-offset-2 hover:text-black hover:underline dark:text-white/40 dark:hover:text-white"
        >
          {email}
        </Link>
      </div>
      <p className="mb-2 mt-3 text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40">
        Твой прогресс
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
          <p className="text-xl font-bold">{wordCount}</p>
          <p className="text-xs text-black/50 dark:text-white/50">Слов в тетради</p>
        </div>
        <div className="rounded-xl bg-black/5 px-3 py-2 dark:bg-white/10">
          <p className="text-xl font-bold">{textCount}</p>
          <p className="text-xs text-black/50 dark:text-white/50">Текстов в библиотеке</p>
        </div>
      </div>
    </div>
  );
}
