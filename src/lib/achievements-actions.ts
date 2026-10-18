import type { SupabaseServerClient } from "@/lib/supabase/server";
import { ACHIEVEMENTS, type AchievementStats } from "@/lib/achievements";
import { log } from "@/lib/log";

async function computeStats(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<AchievementStats | null> {
  const [{ data: profile }, { count: totalWords }, { count: finishedTexts }] = await Promise.all([
    supabase
      .from("profiles")
      .select("streak_current, review_best_session_count")
      .eq("id", ownerId)
      .single(),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("language", language),
    supabase
      .from("text_progress")
      .select("text_id, texts!inner(owner_id, language)", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("texts.language", language)
      .gte("percent_read", 100),
  ]);
  if (!profile) return null;

  return {
    totalWords: totalWords ?? 0,
    finishedTexts: finishedTexts ?? 0,
    currentStreak: profile.streak_current,
    bestSessionCount: profile.review_best_session_count,
  };
}

// Вызывается из точек, где меняется прогресс пользователя (сохранение слова,
// оценка карточки в повторении) — сама не бросает исключений наружу
// (fire-and-forget по духу, раздел 5.2 промта), чтобы сбой подсчёта
// достижений никогда не ломал основное действие.
//
// docs/moments/ROADMAP.md, этап 1: возвращает id действительно НОВЫХ
// достижений (для Achievement-момента) — не просто void. ignoreDuplicates
// заставляет Postgres пропустить (не вернуть) конфликтующие строки, так что
// .select() после upsert отдаёт ровно те achievement_id, которых не было
// раньше (а не все проверенные сейчас совпавшие).
export async function checkAndAwardAchievements(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<string[]> {
  try {
    const stats = await computeStats(supabase, ownerId, language);
    if (!stats) return [];

    const earned = ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => ({
      owner_id: ownerId,
      achievement_id: a.id,
    }));
    if (earned.length === 0) return [];

    const { data: inserted } = await supabase
      .from("user_achievements")
      .upsert(earned, { onConflict: "owner_id,achievement_id", ignoreDuplicates: true })
      .select("achievement_id");

    return (inserted ?? []).map((row) => row.achievement_id as string);
  } catch (e) {
    log.error({
      kind: "achievements_check",
      message: e instanceof Error ? e.message : "unknown",
    });
    return [];
  }
}
