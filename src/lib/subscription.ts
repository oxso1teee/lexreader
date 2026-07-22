import type { SupabaseServerClient } from "@/lib/supabase/server";

export const FREE_TEXT_LIMIT = 3;
export const FREE_DAILY_WORD_LIMIT = 10;
// Мозг (колоды/карточки) — раздел 6.3 роадмапа: продуктовое решение
// зафиксировано явно (не случайный пробел) — свободный тариф ограничен,
// как и остальные части приложения.
export const FREE_DECK_LIMIT = 3;
export const FREE_FLASHCARD_LIMIT = 50;

export type Plan = "free" | "premium_monthly" | "premium_yearly";

export async function getPlan(supabase: SupabaseServerClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!data || data.status !== "active") return "free";
  return data.plan as Plan;
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
