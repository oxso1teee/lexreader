import Link from "next/link";
import { FREE_TEXT_LIMIT } from "@/lib/subscription";

export default function PaywallNotice() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-xl font-bold">Лимит бесплатного тарифа</p>
      <p className="text-[var(--text-secondary)]">
        На бесплатном тарифе можно держать до {FREE_TEXT_LIMIT} текстов одновременно. Оформи
        Premium, чтобы добавлять сколько угодно.
      </p>
      <Link
        href="/paywall?reason=texts"
        className="focus-ring mt-2 min-h-11 rounded-full bg-[var(--color-forest)] px-5 py-3 font-bold text-white"
      >
        Смотреть Premium
      </Link>
    </div>
  );
}
