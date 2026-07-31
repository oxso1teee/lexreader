import type { SupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

// Раздел 5 промта 2026-07-30 (полировка): та же самая точка входа что и
// checkAndAwardAchievements — вызывается из тех же чекпоинтов прогресса,
// сама не бросает исключений наружу.
export async function addXp(supabase: SupabaseServerClient, ownerId: string, amount: number): Promise<void> {
  try {
    const { data: profile } = await supabase.from("profiles").select("xp").eq("id", ownerId).single();
    if (!profile) return;
    await supabase.from("profiles").update({ xp: profile.xp + amount }).eq("id", ownerId);
  } catch (e) {
    log.error({ kind: "xp_update", message: e instanceof Error ? e.message : "unknown" });
  }
}
