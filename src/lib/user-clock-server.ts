import type { SupabaseServerClient } from "./supabase/server.ts";
import { userClock, type UserClock } from "./user-day.ts";

/** Часы пользователя по profiles.timezone. Один небольшой запрос; если профиль
 *  недоступен — UTC (как было до часовых поясов), а не ошибка. */
export async function getUserClock(supabase: SupabaseServerClient, userId: string, now: Date = new Date()): Promise<UserClock> {
  const { data } = await supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  return userClock((data as { timezone: string | null } | null)?.timezone ?? null, now);
}
