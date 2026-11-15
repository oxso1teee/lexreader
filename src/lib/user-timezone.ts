import type { SupabaseServerClient } from "./supabase/server.ts";
import { isValidTimezone } from "./user-day.ts";
import { rewardsPhase, type RewardsPhase } from "./xp/rollout.ts";

export type TimezoneUpdateResult =
  /** Пояс записан. */
  | "changed"
  /** Уже такой же (или не нашлось профиля) — ничего не менялось. */
  | "unchanged"
  /** База отказала: пояс менялся меньше часа назад — антидребезг (profiles_guard_timezone, миграция 0059). */
  | "refused"
  /** Идёт выкладка (фаза overlap, живы старые инстансы приложения): синхронизация пояса приостановлена — база её всё равно не примет (timezone_sync_paused). */
  | "paused"
  /** Не именованный IANA-пояс (проверка в приложении) или не известный PostgreSQL (проверка в базе). */
  | "invalid"
  | "error";

/** Записывает пояс пользователя, если он отличается от сохранённого. Ограничения —
 *  частота смены и допустимые имена — обеспечивает база, а не это приложение: клиент
 *  мог бы писать в profiles напрямую, мимо любой проверки здесь. */
export async function updateTimezoneIfChanged(
  supabase: SupabaseServerClient,
  userId: string,
  timezone: unknown,
  readPhase: () => Promise<RewardsPhase> = rewardsPhase,
): Promise<TimezoneUpdateResult> {
  if (!isValidTimezone(timezone)) return "invalid";
  // Старые инстансы считают день по UTC: локальный день сдвинул бы last_active_date и дневные строки
  // относительно их логики серии. Пока они живы (фаза overlap), пояс остаётся как есть (NULL = UTC).
  if ((await readPhase()) !== "live") return "paused";
  // «is null или neq» — условное обновление: строка меняется только при отличии (в том числе
  // из NULL), поэтому повторные синхронизации не плодят записей и не сдвигают отметку времени.
  const { data, error } = await supabase
    .from("profiles")
    .update({ timezone })
    .eq("id", userId)
    .or(`timezone.is.null,timezone.neq.${timezone}`)
    .select("id");
  if (error) {
    if (error.message.includes("timezone_sync_paused")) return "paused";
    if (error.message.includes("timezone_change_too_frequent")) return "refused";
    if (error.message.includes("invalid_timezone")) return "invalid";
    return "error";
  }
  return data && data.length > 0 ? "changed" : "unchanged";
}
