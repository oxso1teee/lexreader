import type { SupabaseServerClient } from "./supabase/server.ts";
import { awardAchievements, type AchievementPorts } from "./achievements-award.ts";
import type { AchievementStats, StatKey } from "./achievements-catalog.ts";
import { log } from "./log.ts";
import { createServiceClient } from "./supabase/service.ts";
import { loadPendingXp, type RewardsPhase } from "./xp/rollout.ts";

type Loader = () => Promise<number>;

interface ProfileFacts {
  xp: number;
  streak_current: number;
  streak_longest: number;
  review_best_session_count: number;
  perfect_week_awarded_week: string | null;
  daily_quest_chest_claimed_date: string | null;
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>, label: string): Promise<number> {
  const { count: n, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return n ?? 0;
}

/** Показатели достижений из фактов в БД. Загружается только то, что запросили. */
export async function loadAchievementStats(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  keys: readonly StatKey[],
  /** Фаза выкладки; по умолчанию читается из базы. В overlap общий XP — счётчик плюс ещё не применённые события. */
  phase?: RewardsPhase,
): Promise<Partial<AchievementStats>> {
  const { data } = await supabase
    .from("profiles")
    .select("xp, streak_current, streak_longest, review_best_session_count, perfect_week_awarded_week, daily_quest_chest_claimed_date")
    .eq("id", ownerId)
    .maybeSingle();
  const profile = data as ProfileFacts | null;
  if (!profile) throw new Error("profile_not_found");

  const loaders: Record<StatKey, Loader> = {
    totalXp: async () => profile.xp + (await loadPendingXp(supabase, ownerId, phase)).total,
    bestStreak: async () => Math.max(profile.streak_current, profile.streak_longest),
    bestSessionCount: async () => profile.review_best_session_count,
    totalWords: () =>
      count(
        supabase.from("vocabulary_items").select("id", { count: "exact", head: true }).eq("owner_id", ownerId).eq("language", language),
        "vocabulary_items",
      ),
    finishedTexts: () =>
      count(
        supabase
          .from("text_progress")
          .select("text_id, texts!inner(owner_id, language)", { count: "exact", head: true })
          .eq("owner_id", ownerId)
          .eq("texts.language", language)
          .gte("percent_read", 100),
        "text_progress",
      ),
    lessons: () =>
      count(
        supabase.from("user_skill_progress").select("skill_key", { count: "exact", head: true }).eq("user_id", ownerId).not("content_completed_at", "is", null),
        "user_skill_progress",
      ),
    reviewsTotal: () =>
      count(
        supabase.from("review_log").select("id, flashcards!inner(owner_id)", { count: "exact", head: true }).eq("flashcards.owner_id", ownerId),
        "review_log",
      ),
    goalDays: () =>
      count(supabase.from("activity_days").select("day", { count: "exact", head: true }).eq("user_id", ownerId).eq("goal_met", true), "activity_days"),
    // Журнал XP ведётся с Iteration 6; отметки профиля покрывают то, что было до него.
    perfectWeeks: async () => {
      const ledger = await count(
        supabase.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", ownerId).eq("source", "perfect_week"),
        "xp_events",
      );
      return Math.max(ledger, profile.perfect_week_awarded_week ? 1 : 0);
    },
    chests: async () => {
      const ledger = await count(
        supabase.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", ownerId).eq("source", "quest_chest"),
        "xp_events",
      );
      return Math.max(ledger, profile.daily_quest_chest_claimed_date ? 1 : 0);
    },
  };

  const entries = await Promise.all(keys.map(async (key) => [key, await loaders[key]()] as const));
  return Object.fromEntries(entries) as Partial<AchievementStats>;
}

function supabasePorts(supabase: SupabaseServerClient, ownerId: string, language: string, phase?: RewardsPhase): AchievementPorts {
  return {
    async loadEarnedIds() {
      const { data, error } = await supabase.from("user_achievements").select("achievement_id").eq("owner_id", ownerId);
      if (error) throw new Error(`user_achievements: ${error.message}`);
      return new Set((data ?? []).map((row) => row.achievement_id as string));
    },
    loadStats: (keys) => loadAchievementStats(supabase, ownerId, language, keys, phase),
    async insertEarned(ids) {
      // unique(owner_id, achievement_id) + ignoreDuplicates: конфликтующие строки
      // пропускаются и в ответ не попадают, так что при гонке двух вызовов каждое
      // достижение «новое» ровно для одного из них.
      // Запись — сервисной ролью: клиентской роли вставка в user_achievements закрыта
      // (миграция 0059), иначе достижение можно было бы выдать себе запросом из браузера.
      // ownerId приходит только из серверной сессии вызывающего кода.
      const { data, error } = await createServiceClient()
        .from("user_achievements")
        .upsert(
          ids.map((id) => ({ owner_id: ownerId, achievement_id: id })),
          { onConflict: "owner_id,achievement_id", ignoreDuplicates: true },
        )
        .select("achievement_id");
      if (error) throw new Error(`user_achievements: ${error.message}`);
      return (data ?? []).map((row) => row.achievement_id as string);
    },
  };
}

/** То же, но язык берётся из профиля — для мест, где он не под рукой (урок, сундук, чтение). */
export async function checkAchievementsForUser(supabase: SupabaseServerClient, ownerId: string): Promise<string[]> {
  try {
    const { data } = await supabase.from("profiles").select("target_language").eq("id", ownerId).maybeSingle();
    const language = (data as { target_language: string } | null)?.target_language;
    return language ? await checkAndAwardAchievements(supabase, ownerId, language) : [];
  } catch (e) {
    log.error({ kind: "achievements_check", message: e instanceof Error ? e.message : "unknown" });
    return [];
  }
}

// Вызывается из точек, где меняется прогресс пользователя (сохранение слова,
// оценка карточки, завершение урока, дочитанный текст, сундук) — сама не бросает
// исключений наружу (fire-and-forget по духу, раздел 5.2 промта), чтобы сбой
// подсчёта достижений никогда не ломал основное действие.
//
// docs/moments/ROADMAP.md, этап 1: возвращает id действительно НОВЫХ достижений
// (для Achievement-момента) — не просто void.
export async function checkAndAwardAchievements(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  phase?: RewardsPhase,
): Promise<string[]> {
  try {
    return await awardAchievements(supabasePorts(supabase, ownerId, language, phase));
  } catch (e) {
    log.error({
      kind: "achievements_check",
      message: e instanceof Error ? e.message : "unknown",
    });
    return [];
  }
}
