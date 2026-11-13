"use server";

import { createClient } from "@/lib/supabase/server";
import { claimDailyQuestChest, type ClaimChestResult } from "@/lib/daily-quests";

export async function claimChestAction(): Promise<ClaimChestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };
  return claimDailyQuestChest(supabase, user.id);
}
