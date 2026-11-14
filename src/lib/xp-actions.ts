// XP начисляется ТОЛЬКО через awardXp() (src/lib/xp/award.ts) — единый путь с
// журналом xp_events, идемпотентностью и дневными лимитами. Прежний addXp()
// (чтение, затем запись profiles.xp/activity_days) удалён: он был неатомарным
// (параллельные начисления теряли XP) и не имел защиты от повторов.
//
// Здесь остаётся только совместимый тип результата, на который рассчитан сбор
// моментов (collectMoments), и todayUtcIso() для ключей-идентификаторов.
export type { AddXpResult } from "./xp/award.ts";

/** UTC-дата «сегодня». Нужна только как часть идентификатора момента (чтобы
 *  экран не повторялся в тот же день); день цели/серии/XP считает userClock(). */
export function todayUtcIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
}
