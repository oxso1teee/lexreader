import type { SupabaseServerClient } from "@/lib/supabase/server";

export const FREE_TEXT_LIMIT = 3;
export const FREE_DAILY_WORD_LIMIT = 10;

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
