"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Plan } from "@/lib/subscription";

// Локальная заглушка для тестирования лимитов без реальной оплаты.
// Настоящая оплата подписки идёт через RevenueCat + Apple StoreKit / Google
// Billing (раздел 8 ТЗ) — для этого нужны отдельные аккаунты разработчика
// (Apple Developer Program, Google Play Console, RevenueCat), которые может
// завести только сам пользователь. Здесь их нет и не будет — эта кнопка
// только пишет статус подписки в БД для локальной разработки.
export async function simulateSubscribe(plan: Extract<Plan, "premium_monthly" | "premium_yearly">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("subscriptions").upsert({
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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("subscriptions").update({ status: "canceled" }).eq("owner_id", user.id);
  revalidatePath("/paywall");
}
