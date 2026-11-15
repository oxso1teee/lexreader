import { log } from "../log.ts";
import type { SupabaseServerClient } from "../supabase/server.ts";
import { createServiceClient } from "../supabase/service.ts";
import { loadDailyActivity } from "./activity.ts";
import { syncGoalProgress, type GoalSyncOptions, type GoalSyncPorts, type GoalSyncResult } from "./goal-sync.ts";

export function supabaseGoalSyncPorts(supabase: SupabaseServerClient): GoalSyncPorts {
  return {
    async loadProfile(userId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("timezone, target_language, daily_xp_goal, daily_goal_type, daily_goal_target")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw new Error(`profiles: ${error.message}`);
      return data ?? null;
    },
    async isGoalMet(userId, day) {
      const { data, error } = await supabase.from("activity_days").select("goal_met").eq("user_id", userId).eq("day", day).maybeSingle();
      if (error) throw new Error(`activity_days: ${error.message}`);
      return (data as { goal_met: boolean } | null)?.goal_met === true;
    },
    loadActivity: (userId, day, language, timezone) => loadDailyActivity(supabase, userId, language, day, timezone),
    async markGoalMet(userId, day) {
      // Сервисной ролью: запись в activity_days закрыта для клиента (миграция 0059).
      // userId приходит из серверной сессии вызывающего кода.
      const { data, error } = await createServiceClient().rpc("mark_goal_met", { p_user: userId, p_day: day });
      if (error) throw new Error(`mark_goal_met: ${error.message}`);
      return data === true;
    },
  };
}

/** Синхронизация отметки «цель дня выполнена» после действия пользователя. Не бросает:
 *  сбой подсчёта цели не должен ломать основное действие — при следующем действии
 *  отметка будет поставлена по тем же фактам. */
export async function syncGoalProgressFor(
  supabase: SupabaseServerClient,
  userId: string,
  options: GoalSyncOptions = {},
): Promise<GoalSyncResult | null> {
  try {
    return await syncGoalProgress(supabaseGoalSyncPorts(supabase), userId, options);
  } catch (error) {
    log.error({ kind: "goal_sync", message: error instanceof Error ? error.message : "unknown" });
    return null;
  }
}
