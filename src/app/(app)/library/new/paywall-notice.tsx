import Link from "next/link";
import { FREE_TEXT_LIMIT } from "@/lib/subscription";

export default function PaywallNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-xl font-semibold">Лимит бесплатного тарифа</p>
      <p className="text-black/60 dark:text-white/60">
        На бесплатном тарифе можно держать до {FREE_TEXT_LIMIT} текстов одновременно. Оформи
        Premium, чтобы добавлять сколько угодно.
      </p>
      <Link
        href="/paywall?reason=texts"
        className="mt-2 rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
      >
        Смотреть Premium
      </Link>
    </div>
  );
}
