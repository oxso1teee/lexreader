import { loadAchievementStats } from "../achievements-actions.ts";
import { ACHIEVEMENT_DEFS, buildAchievementViews, neededStats, type AchievementView } from "../achievements-catalog.ts";
import type { SupabaseServerClient } from "../supabase/server.ts";

// Витрина достижений: факт получения — из user_achievements (с датой), прогресс по ещё
// не полученным — из реальных показателей. Показатели полученных не считаем.
export async function loadAchievementViews(supabase: SupabaseServerClient, ownerId: string, language: string): Promise<AchievementView[]> {
  const { data, error } = await supabase.from("user_achievements").select("achievement_id, earned_at").eq("owner_id", ownerId);
  if (error) throw new Error(`user_achievements: ${error.message}`);
  const earned = new Map((data ?? []).map((row) => [row.achievement_id as string, (row.earned_at as string | null) ?? null]));

  const locked = ACHIEVEMENT_DEFS.filter((d) => !earned.has(d.id));
  const stats = locked.length > 0 ? await loadAchievementStats(supabase, ownerId, language, neededStats(locked)) : {};
  return buildAchievementViews(stats, earned);
}

export interface RecentAchievement {
  id: string;
  earnedAt: string;
}

/** Последние полученные достижения — для карточки наград на главном экране. */
export async function loadRecentAchievements(supabase: SupabaseServerClient, ownerId: string, limit = 3): Promise<RecentAchievement[]> {
  const { data, error } = await supabase
    .from("user_achievements")
    .select("achievement_id, earned_at")
    .eq("owner_id", ownerId)
    .order("earned_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`user_achievements: ${error.message}`);
  return (data ?? []).map((row) => ({ id: row.achievement_id as string, earnedAt: row.earned_at as string }));
}
