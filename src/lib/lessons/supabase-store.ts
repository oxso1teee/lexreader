import type { SupabaseServerClient } from "../supabase/server.ts";
import type { PathSlug } from "../learning-paths/types.ts";
import type { AttemptStore, CompletionWrite, CreateAttemptInput, ProgressWrite } from "./ports.ts";
import type { AttemptRecord, AttemptStatus, LessonMode, SkillAddress, StoredAnswer } from "./types.ts";

// Реализация AttemptStore на Supabase (таблица lesson_attempts, миграция 0058).
//
// Два клиента, потому что у таблицы разная модель доверия на чтение и запись:
//   read  — клиент пользователя (RLS: только свои строки). Строки фильтруются
//           по user_id ещё и в запросе — RLS не единственная защита;
//   write — service_role. Запись идёт только отсюда: authenticated на запись
//           в lesson_attempts прав не имеет, поэтому подделать ответы или
//           «XP получен» напрямую через PostgREST нельзя.
// userId приходит из серверной сессии при создании хранилища и применяется
// в каждом запросе; ни один метод не принимает user id из аргументов.
//
// Исходы, которые нельзя путать с ошибкой (проверены на реальном Postgres):
//   • UPDATE ... WHERE <ожидаемое состояние> вернул 0 строк — проигранная
//     гонка, а не сбой: возвращаем null/false;
//   • 23505 на INSERT открытой попытки — её уже создал параллельный запрос;
//   • 23505 на claim XP — право на навык занято другой попыткой.

type Db = Pick<SupabaseServerClient, "from">;

const TABLE = "lesson_attempts";
const UNIQUE_VIOLATION = "23505";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AttemptRow {
  id: string;
  user_id: string;
  path_slug: string;
  path_version: number;
  skill_key: string;
  mode: string;
  status: string;
  step_index: number;
  steps_total: number;
  plan_signature: string;
  answers: unknown;
  correct_count: number;
  incorrect_count: number;
  passed: boolean | null;
  score_ratio: number | string | null;
  xp_awarded: number;
  xp_claimed_at: string | null;
  started_at: string;
  last_activity_at: string;
  completed_at: string | null;
  finalized_at: string | null;
}

export function toAttemptRecord(row: AttemptRow): AttemptRecord {
  return {
    id: row.id,
    userId: row.user_id,
    pathSlug: row.path_slug as PathSlug,
    pathVersion: row.path_version,
    skillKey: row.skill_key,
    mode: row.mode as LessonMode,
    status: row.status as AttemptStatus,
    stepIndex: row.step_index,
    stepsTotal: row.steps_total,
    signature: row.plan_signature,
    // Содержимое проверяется при чтении (sanitizeStoredAnswers), здесь — только форма.
    answers: Array.isArray(row.answers) ? (row.answers as StoredAnswer[]) : [],
    correctCount: row.correct_count,
    incorrectCount: row.incorrect_count,
    passed: row.passed,
    scoreRatio: row.score_ratio === null ? null : Number(row.score_ratio),
    xpAwarded: row.xp_awarded,
    xpClaimedAt: row.xp_claimed_at,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    completedAt: row.completed_at,
    finalizedAt: row.finalized_at,
  };
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`lesson_attempts ${action}: ${error.message}`);
}

export function createSupabaseAttemptStore(options: { read: Db; write: Db; userId: string; now?: () => string }): AttemptStore {
  const { read, write, userId } = options;
  const now = options.now ?? (() => new Date().toISOString());

  async function findById(attemptId: string): Promise<AttemptRecord | null> {
    // id приходит от клиента: не-UUID дал бы ошибку приведения типа в Postgres, и
    // сервис ответил бы «сбой хранилища» вместо «не найдено».
    if (!UUID_PATTERN.test(attemptId)) return null;
    const { data, error } = await read.from(TABLE).select("*").eq("id", attemptId).eq("user_id", userId).maybeSingle();
    if (error) fail("read", error);
    return data ? toAttemptRecord(data as AttemptRow) : null;
  }

  async function findOpen(address: SkillAddress, mode: LessonMode): Promise<AttemptRecord | null> {
    const { data, error } = await read
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .eq("path_slug", address.pathSlug)
      .eq("path_version", address.pathVersion)
      .eq("skill_key", address.skillKey)
      .eq("mode", mode)
      .eq("status", "in_progress")
      .maybeSingle();
    if (error) fail("read open", error);
    return data ? toAttemptRecord(data as AttemptRow) : null;
  }

  return {
    findById,
    findOpen,

    async findLatestCompleted(address) {
      const { data, error } = await read
        .from(TABLE)
        .select("*")
        .eq("user_id", userId)
        .eq("path_slug", address.pathSlug)
        .eq("path_version", address.pathVersion)
        .eq("skill_key", address.skillKey)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) fail("read latest", error);
      return data ? toAttemptRecord(data as AttemptRow) : null;
    },

    async create(input: CreateAttemptInput) {
      const { data, error } = await write
        .from(TABLE)
        .insert({
          user_id: userId,
          path_slug: input.pathSlug,
          path_version: input.pathVersion,
          skill_key: input.skillKey,
          mode: input.mode,
          steps_total: input.stepsTotal,
          plan_signature: input.signature,
        })
        .select("*")
        .single();
      if (!error && data) return toAttemptRecord(data as AttemptRow);
      if (error?.code === UNIQUE_VIOLATION) {
        // Параллельный запрос успел создать открытую попытку — берём её.
        const existing = await findOpen(input, input.mode);
        if (existing) return existing;
      }
      return fail("create", error ?? { message: "no row returned" });
    },

    async abandon(attemptId) {
      const { error } = await write
        .from(TABLE)
        .update({ status: "abandoned", last_activity_at: now() })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .eq("status", "in_progress");
      if (error) fail("abandon", error);
    },

    async saveProgress(attemptId, expectedStepIndex, next: ProgressWrite) {
      const { data, error } = await write
        .from(TABLE)
        .update({
          step_index: next.stepIndex,
          answers: next.answers,
          correct_count: next.correctCount,
          incorrect_count: next.incorrectCount,
          last_activity_at: now(),
        })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .eq("step_index", expectedStepIndex)
        .select("*");
      if (error) fail("save progress", error);
      return data && data.length > 0 ? toAttemptRecord(data[0] as AttemptRow) : null;
    },

    async markCompleted(attemptId, result: CompletionWrite) {
      const timestamp = now();
      const { data, error } = await write
        .from(TABLE)
        .update({
          status: "completed",
          passed: result.passed,
          score_ratio: result.scoreRatio,
          correct_count: result.correctCount,
          incorrect_count: result.incorrectCount,
          completed_at: timestamp,
          last_activity_at: timestamp,
        })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .eq("status", "in_progress")
        .select("*");
      if (error) fail("complete", error);
      return data && data.length > 0 ? toAttemptRecord(data[0] as AttemptRow) : null;
    },

    async claimXp(attemptId, amount) {
      const { data, error } = await write
        .from(TABLE)
        .update({ xp_claimed_at: now(), xp_awarded: amount })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .eq("status", "completed")
        .is("xp_claimed_at", null)
        .select("id");
      // 23505: право на этот навык уже занято другой попыткой — не ошибка.
      if (error?.code === UNIQUE_VIOLATION) return false;
      if (error) fail("claim xp", error);
      return Boolean(data && data.length > 0);
    },

    async setXpAwarded(attemptId, amount) {
      // Уточнение суммы (Double-XP) — не критично: при сбое остаётся базовая.
      await write
        .from(TABLE)
        .update({ xp_awarded: amount })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .not("xp_claimed_at", "is", null);
    },

    async releaseXpClaim(attemptId) {
      // Только если XP не начислен (см. RewardPort.grantXp): иначе повтор выдал бы награду дважды.
      const { error } = await write
        .from(TABLE)
        .update({ xp_claimed_at: null, xp_awarded: 0 })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .eq("status", "completed")
        .not("xp_claimed_at", "is", null);
      if (error) fail("release xp claim", error);
    },

    async hasXpClaim(address) {
      const { count, error } = await read
        .from(TABLE)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("path_slug", address.pathSlug)
        .eq("path_version", address.pathVersion)
        .eq("skill_key", address.skillKey)
        .not("xp_claimed_at", "is", null);
      if (error) fail("read xp claim", error);
      return (count ?? 0) > 0;
    },

    async markFinalized(attemptId) {
      const { error } = await write
        .from(TABLE)
        .update({ finalized_at: now() })
        .eq("id", attemptId)
        .eq("user_id", userId)
        .is("finalized_at", null);
      if (error) fail("finalize", error);
    },
  };
}
