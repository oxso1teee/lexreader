import type { SupabaseServerClient } from "@/lib/supabase/server";

export const FREE_TEXT_LIMIT = 3;
export const FREE_DAILY_WORD_LIMIT = 10;
// Мозг (колоды/карточки) — раздел 6.3 роадмапа: продуктовое решение
// зафиксировано явно (не случайный пробел) — свободный тариф ограничен,
// как и остальные части приложения.
export const FREE_DECK_LIMIT = 3;
export const FREE_FLASHCARD_LIMIT = 50;

export type Plan = "free" | "premium_monthly" | "premium_yearly";

// P0-PAY-04: неудачное списание не должно мгновенно отключать премиум —
// даём grace period, чтобы пользователь успел обновить способ оплаты.
export const PAYMENT_GRACE_PERIOD_DAYS = 3;

export async function getPlan(supabase: SupabaseServerClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!data) return "free";
  if (data.status === "active") return data.plan as Plan;

  if (data.status === "past_due" && data.current_period_end) {
    const graceEnd =
      new Date(data.current_period_end).getTime() + PAYMENT_GRACE_PERIOD_DAYS * 86_400_000;
    if (Date.now() < graceEnd) return data.plan as Plan;
  }

  return "free";
}

export async function hasFreeDeckRoom(
  supabase: SupabaseServerClient,
  ownerId: string,
): Promise<boolean> {
  const plan = await getPlan(supabase, ownerId);
  if (plan !== "free") return true;

  const { count } = await supabase
    .from("decks")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return (count ?? 0) < FREE_DECK_LIMIT;
}

export async function hasFreeFlashcardRoom(
  supabase: SupabaseServerClient,
  ownerId: string,
  additional = 1,
): Promise<boolean> {
  const plan = await getPlan(supabase, ownerId);
  if (plan !== "free") return true;

  const { count } = await supabase
    .from("flashcards")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return (count ?? 0) + additional <= FREE_FLASHCARD_LIMIT;
}
