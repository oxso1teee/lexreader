import { log } from "../log.ts";
import { createServiceClient } from "../supabase/service.ts";
import { validateAward, type AwardRejection, type AwardRequest } from "./sources.ts";

// Единая точка начисления XP. Всё, что даёт опыт в приложении, проходит здесь:
//   1) запрос проверяется по каталогу источников (sources.ts) — неизвестный
//      источник, чужая сумма или отсутствие ключа отклоняются ещё до БД;
//   2) начисляет БД одной транзакцией (award_xp, миграция 0059): под блокировкой
//      профиля проверяет ключ идемпотентности и дневной лимит, применяет
//      Double-XP, пишет xp_events, profiles.xp и activity_days;
//   3) повтор того же ключа возвращает duplicate и ничего не меняет.
//
// RPC вызывается service_role (прав у authenticated на неё нет), от имени
// пользователя из серверной сессии — userId сюда передаёт только серверный код.
//
// Выкладка: пока живы старые инстансы приложения (фаза overlap, rollout.ts), award_xp пишет
// только журнал (applied = false), а в счётчики событие переносит миграция 0060. Ответ при этом
// тот же: «было/стало» считаются как счётчик + неприменённое, поэтому моменты и тосты верны.

export interface XpTotals {
  before: number;
  after: number;
}

/** Совместимая с прежним addXp() форма — на неё рассчитан сбор моментов. */
export interface AddXpResult {
  total: XpTotals;
  /** activity_days.xp за локальный день пользователя — цель дня считается по нему. */
  today: XpTotals;
  goal: number;
  /** Реально начислено (с Double-XP) — именно это показывается как «+N XP». */
  awarded: number;
  boosted: boolean;
  /** Локальный день, в который записано начисление. */
  day: string;
}

export type AwardOutcome =
  | { status: "awarded"; result: AddXpResult; base: number; eventId: string }
  /** Тот же источник+ключ уже начислялся: ничего не изменилось. */
  | { status: "duplicate"; awarded: number }
  /** Дневной лимит источника исчерпан. */
  | { status: "capped" }
  | { status: "rejected"; reason: AwardRejection }
  | { status: "no_profile" }
  /** Хранилище недоступно или ответило неожиданно: транзакция откатилась, ничего не записано — повтор безопасен. */
  | { status: "failed" };

export interface AwardRpcArgs {
  p_user: string;
  p_source: string;
  p_ref: string | null;
  p_amount: number;
  p_daily_cap: number | null;
}

export type AwardRpc = (args: AwardRpcArgs) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

const defaultRpc: AwardRpc = async (args) => {
  const service = createServiceClient();
  const { data, error } = await service.rpc("award_xp", args);
  return { data, error: error ? { message: error.message, code: error.code } : null };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function int(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

/** Разбор ответа award_xp. Неожиданная форма — failed, а не угаданный успех. */
export function parseAwardResponse(data: unknown, base: number): AwardOutcome {
  if (!isRecord(data) || typeof data.status !== "string") return { status: "failed" };
  switch (data.status) {
    case "awarded": {
      const awarded = int(data.awarded);
      const totalBefore = int(data.total_before);
      const totalAfter = int(data.total_after);
      const todayBefore = int(data.today_before);
      const todayAfter = int(data.today_after);
      const goal = int(data.goal);
      if (
        awarded === null || totalBefore === null || totalAfter === null || todayBefore === null || todayAfter === null ||
        goal === null || typeof data.day !== "string" || typeof data.event_id !== "string"
      ) {
        return { status: "failed" };
      }
      return {
        status: "awarded",
        base,
        eventId: data.event_id,
        result: {
          awarded,
          boosted: data.boosted === true,
          goal,
          day: data.day,
          total: { before: totalBefore, after: totalAfter },
          today: { before: todayBefore, after: todayAfter },
        },
      };
    }
    case "duplicate":
      return { status: "duplicate", awarded: int(data.awarded) ?? 0 };
    case "capped":
      return { status: "capped" };
    case "no_profile":
      return { status: "no_profile" };
    default:
      return { status: "failed" };
  }
}

export async function awardXp(userId: string, request: AwardRequest, rpc: AwardRpc = defaultRpc): Promise<AwardOutcome> {
  const checked = validateAward(request);
  if (!checked.ok) return { status: "rejected", reason: checked.reason };
  if (typeof userId !== "string" || userId.length === 0) return { status: "rejected", reason: "invalid_source" };

  try {
    const { data, error } = await rpc({
      p_user: userId,
      p_source: checked.source.id,
      p_ref: checked.ref,
      p_amount: checked.amount,
      p_daily_cap: checked.source.dailyCap ?? null,
    });
    if (error) {
      log.error({ kind: "xp_award", message: `${checked.source.id}: ${error.message}` });
      return { status: "failed" };
    }
    const outcome = parseAwardResponse(data, checked.amount);
    if (outcome.status === "failed") log.error({ kind: "xp_award", message: `${checked.source.id}: unexpected response` });
    return outcome;
  } catch (error) {
    log.error({ kind: "xp_award", message: `${checked.source.id}: ${error instanceof Error ? error.message : "unknown"}` });
    return { status: "failed" };
  }
}

/** Для кода, который строит моменты по прежней форме: результат только у реального начисления. */
export function toAddXpResult(outcome: AwardOutcome): AddXpResult | null {
  return outcome.status === "awarded" ? outcome.result : null;
}
