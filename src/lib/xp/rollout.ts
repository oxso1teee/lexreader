import { log } from "../log.ts";
import type { SupabaseServerClient } from "../supabase/server.ts";
import { createServiceClient } from "../supabase/service.ts";

// Барьер выкладки наград (миграция 0059, rollout_state). Пока живы старые инстансы приложения, они
// перезаписывают счётчики XP абсолютными значениями, поэтому награды нового кода копятся в журнале
// xp_events (applied = false) и переносятся в счётчики одной операцией миграции 0060. Здесь — то, что
// на это опирается в приложении:
//   • фаза «overlap» / «live» (RPC rewards_phase, сервисная роль);
//   • в overlap новый код ведёт себя «по-старому» там, где иначе сломал бы старые инстансы: выдаёт только
//     прежние типы заданий и не синхронизирует часовой пояс (последнее база тоже запрещает);
//   • в overlap суммы XP на экранах берутся с поправкой на ещё не применённые события журнала, чтобы
//     цель дня и общий XP не отставали от начисленного.
// Ошибка чтения фазы трактуется как overlap — осторожный режим: прежние типы заданий, пояс не пишем.
// Ничего не теряется ни при какой фазе: награды в любом случае лежат в журнале.

export type RewardsPhase = "overlap" | "live";

export function parseRewardsPhase(value: unknown): RewardsPhase {
  return value === "live" ? "live" : "overlap";
}

export type PhaseReader = () => Promise<unknown>;

const defaultReader: PhaseReader = async () => {
  const { data, error } = await createServiceClient().rpc("rewards_phase");
  if (error) throw new Error(error.message);
  return data;
};

/** Сколько живёт в памяти ответ «overlap». «live» необратим, поэтому кэшируется навсегда. */
export const OVERLAP_CACHE_MS = 15_000;

/** Источник фазы с собственным кэшем: отдельный экземпляр на тест, общий — на процесс. */
export function createPhaseSource(read: PhaseReader = defaultReader, clock: () => number = Date.now): () => Promise<RewardsPhase> {
  let cached: { phase: RewardsPhase; at: number } | null = null;
  return async () => {
    if (cached?.phase === "live") return "live";
    const now = clock();
    if (cached && now - cached.at < OVERLAP_CACHE_MS) return cached.phase;
    try {
      const phase = parseRewardsPhase(await read());
      cached = { phase, at: now };
      return phase;
    } catch (error) {
      // не кэшируем сбой: следующий вызов попробует снова; пока — осторожный режим
      log.error({ kind: "rewards_phase", message: error instanceof Error ? error.message : "unknown" });
      return "overlap";
    }
  };
}

export const rewardsPhase = createPhaseSource();

// ---------- поправка сумм на неприменённые события ----------

export interface PendingXp {
  /** Сумма неприменённых событий пользователя. */
  total: number;
  /** То же по дням (UTC-дни overlap) — для цели дня. */
  byDay: ReadonlyMap<string, number>;
}

export const NO_PENDING_XP: PendingXp = { total: 0, byDay: new Map() };

/** Неприменённые начисления пользователя. В фазе live их не бывает — запрос не выполняется.
 *  Ошибка чтения не роняет экран: суммы просто отстают до переноса (0060). */
export async function loadPendingXp(
  supabase: SupabaseServerClient,
  userId: string,
  phase?: RewardsPhase,
  readPhase: () => Promise<RewardsPhase> = rewardsPhase,
): Promise<PendingXp> {
  if ((phase ?? (await readPhase())) === "live") return NO_PENDING_XP;
  const { data, error } = await supabase.from("xp_events").select("day, amount").eq("user_id", userId).eq("applied", false);
  if (error) {
    log.error({ kind: "rewards_pending_xp", message: error.message });
    return NO_PENDING_XP;
  }
  const byDay = new Map<string, number>();
  let total = 0;
  for (const row of (data ?? []) as Array<{ day: string; amount: number }>) {
    if (typeof row.day !== "string" || !Number.isInteger(row.amount) || row.amount < 1) continue;
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.amount);
    total += row.amount;
  }
  return { total, byDay };
}
