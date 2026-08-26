"use client";

import Link from "next/link";
import { FREE_TEXT_LIMIT } from "@/lib/subscription";
import { useIsNativePlatform } from "@/lib/use-is-native";

export default function PaywallNotice() {
  const isNative = useIsNativePlatform();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="text-xl font-bold">Лимит бесплатного тарифа</p>
      {isNative ? (
        // см. src/lib/use-is-native.ts — v1 обёртки не ведёт на покупку
        // подписки внутри приложения, поэтому Premium тут даже не
        // упоминается как вариант с кнопкой.
        <p className="text-[var(--text-secondary)]">
          На бесплатном тарифе можно держать до {FREE_TEXT_LIMIT} текстов одновременно.
        </p>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
