"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkAchievementsForUser } from "@/lib/achievements-actions";
import { claimDailyQuestChest, type ClaimChestResult } from "@/lib/daily-quests";

export async function claimChestAction(): Promise<ClaimChestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };
  const result = await claimDailyQuestChest(supabase, user.id);
  if (result.ok) {
    // Первый сундук и вехи XP — достижения; сбой проверки (она сама не бросает) сундук не откатывает.
    await checkAchievementsForUser(supabase, user.id);
    revalidatePath("/home");
    revalidatePath("/rewards");
  }
  return result;
}
