// M2 Learning Upgrade (LEARN-003): адаптер ts-fsrs поверх существующего
// srs_state/review_log. Не зависит от React/Supabase — читает и возвращает
// только плоские данные, вызывающий код (server action) сам отвечает за
// чтение из БД и запись обратно.
//
// API проверен напрямую в node_modules/ts-fsrs/dist/index.d.ts (версия
// 5.4.1) перед использованием, а не взят по памяти из документации плана —
// в частности, Rating в этой версии начинается с Manual=0
// (Again=1, Hard=2, Good=3, Easy=4), не с Again=0, как можно было бы
// предположить по более старым описаниям API.
import { createEmptyCard, dateDiffInDays, fsrs, generatorParameters, Rating, State, type Card } from "ts-fsrs";

const GRADE_TO_RATING = {
  0: Rating.Again,
  1: Rating.Hard,
  2: Rating.Good,
  3: Rating.Easy,
} as const;

export interface FsrsStateRow {
  fsrsStability: number | null;
  fsrsDifficulty: number | null;
  /** ts-fsrs State enum (0=New 1=Learning 2=Review 3=Relearning), null = карточка ещё не проходила ревью под FSRS. */
  fsrsState: number | null;
  fsrsLapses: number;
  fsrsReps: number;
  fsrsScheduledDays: number;
  /** Общая с legacy-алгоритмом колонка srs_state.due_at. */
  dueAt: string;
  /** Общая с legacy-алгоритмом колонка srs_state.last_reviewed_at. */
  lastReviewedAt: string | null;
}

export interface FsrsReviewResult {
  dueAt: string;
  fsrsStability: number;
  fsrsDifficulty: number;
  fsrsState: number;
  fsrsLapses: number;
  fsrsReps: number;
  fsrsScheduledDays: number;
  /** Полное состояние карточки до этого ревью — для review_log.previous_state_json. */
  previousState: Card;
  /** Полное состояние карточки после этого ревью — для review_log.next_state_json. */
  nextState: Card;
}

function rowToCard(row: FsrsStateRow, now: Date): Card {
  if (row.fsrsStability == null || row.fsrsState == null) {
    return createEmptyCard(now);
  }
  const lastReview = row.lastReviewedAt ? new Date(row.lastReviewedAt) : undefined;
  return {
    due: new Date(row.dueAt),
    stability: row.fsrsStability,
    difficulty: row.fsrsDifficulty ?? 0,
    elapsed_days: lastReview ? dateDiffInDays(lastReview, now) : 0,
    scheduled_days: row.fsrsScheduledDays,
    // enable_short_term: false ниже отключает внутридневные learning/
    // relearning шаги (как и старый алгоритм, FSRS здесь считает только
    // целыми днями) — это поле не продвигается, 0 всегда корректен.
    learning_steps: 0,
    reps: row.fsrsReps,
    lapses: row.fsrsLapses,
    state: row.fsrsState as State,
    last_review: lastReview,
  };
}

/**
 * Планирует следующее повторение через ts-fsrs. Чистая функция: не читает
 * и не пишет в БД, не знает про React/Supabase — вызывающий код передаёт
 * текущее состояние и сохраняет результат сам. Используется и на сервере
 * (реальное сохранение оценки), и на клиенте (предпросмотр интервала на
 * кнопках оценки, без сохранения) — одна и та же логика, без дублирования.
 */
export function reviewFsrsCard(
  row: FsrsStateRow,
  grade: 0 | 1 | 2 | 3,
  maxIntervalDays: number,
  now: Date = new Date(),
): FsrsReviewResult {
  const scheduler = fsrs(
    generatorParameters({
      maximum_interval: maxIntervalDays,
      enable_fuzz: true,
      enable_short_term: false,
    }),
  );
  const card = rowToCard(row, now);
  const { card: nextCard } = scheduler.next(card, now, GRADE_TO_RATING[grade]);

  return {
    dueAt: nextCard.due.toISOString(),
    fsrsStability: nextCard.stability,
    fsrsDifficulty: nextCard.difficulty,
    fsrsState: nextCard.state,
    fsrsLapses: nextCard.lapses,
    fsrsReps: nextCard.reps,
    fsrsScheduledDays: nextCard.scheduled_days,
    previousState: card,
    nextState: nextCard,
  };
}

/**
 * FSRS Release Review (Шаг 5): reviewFsrsCard() раньше вызывался в actions.ts
 * без изоляции — падение shadow-расчёта (например, из-за неожиданной формы
 * строки БД) обрывало reviewWord() до записи srs_state/review_log, то есть
 * ломало и legacy-повторение тоже, даже при FSRS_ENABLED=false. Эта обёртка
 * гарантирует, что вызывающий код (actions.ts) всегда может продолжить по
 * старому алгоритму: при ошибке возвращает null вместо исключения. В лог
 * попадает только текст ошибки (без содержимого строки srs_state/карточки —
 * не приватные данные), flashcardId можно безопасно добавить в вызывающем
 * коде как непрозрачный идентификатор для диагностики.
 */
export function computeFsrsShadowSafe(
  row: FsrsStateRow,
  grade: 0 | 1 | 2 | 3,
  maxIntervalDays: number,
  now: Date = new Date(),
): FsrsReviewResult | null {
  try {
    return reviewFsrsCard(row, grade, maxIntervalDays, now);
  } catch (error) {
    console.error(
      "[fsrs] shadow calculation failed, falling back to legacy scheduling:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

/**
 * Server-side флаг rollout (LEARN-010). Читается только из вызывающего
 * серверного кода (server actions/page.tsx) — сам по себе ничего не
 * защищает, но и не предназначен для этого: единственная точка, где
 * FSRS_ENABLED реально решает, какой алгоритм авторитетен для due_at —
 * src/app/(app)/brain/[deckId]/review/actions.ts (reviewWord). Клиентские
 * компоненты получают уже вычисленное здесь значение как проп, только для
 * выбора, какой предпросмотр интервала показать — переопределить его на
 * клиенте нельзя, потому что реальное сохранение всё равно проверяет флаг
 * заново на сервере.
 */
export function isFsrsEnabled(): boolean {
  return process.env.FSRS_ENABLED === "true";
}

/**
 * Production incident (2026-08-01): code and migration 0032 were deployed as
 * two separate steps ("код сначала, миграция потом"), but reviewWord()/the
 * review page unconditionally selected fsrs_* columns — PostgREST rejects
 * queries referencing columns that don't exist yet (Postgres SQLSTATE 42703,
 * "undefined_column"), which broke every review save/load until migration
 * 0032 was applied. Callers use this to detect exactly that case and fall
 * back to a legacy-only query instead of failing the whole request.
 */
export function isMissingFsrsColumnsError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42703";
}

/**
 * FSRS Schema Compatibility Hotfix: отдельный от FSRS_ENABLED флаг —
 * подтверждение того, что migration 0032 применена к текущей БД. Read-путь
 * (src/lib/fsrs-flags.ts) решает, включать ли fsrs_*-колонки в запрос,
 * ДО его отправки — это не замена, а дополнение к isMissingFsrsColumnsError:
 * если флаг всё же выставлен неверно (миграция на самом деле не применена),
 * запрос ниже (selectWithFsrsSchemaFallback) всё равно поймает 42703 и
 * откатится на легаси-запрос, вместо того чтобы падать.
 */
export function isFsrsSchemaReady(): boolean {
  return process.env.FSRS_SCHEMA_READY === "true";
}

/**
 * Выполняет FSRS-запрос только если schemaReady=true; иначе сразу уходит на
 * легаси-запрос, не пытаясь обратиться к несуществующим колонкам вообще
 * ("нельзя надеяться, что Supabase проигнорирует неизвестные колонки" —
 * поэтому здесь два РАЗНЫХ запроса, а не один с опциональными полями).
 * Если schemaReady=true, но колонок всё ещё нет (флаг выставлен раньше
 * реальной миграции), 42703 от FSRS-запроса всё равно откатывается на
 * легаси — defense in depth, а не единственная защита.
 */
export async function selectWithFsrsSchemaFallback<TFsrs, TLegacy>(
  schemaReady: boolean,
  // PromiseLike, не Promise — Supabase-js query builder — thenable, но не
  // структурно совместим с Promise (нет catch/finally/Symbol.toStringTag).
  runFsrsQuery: () => PromiseLike<{ data: TFsrs | null; error: { code?: string } | null }>,
  runLegacyQuery: () => PromiseLike<{ data: TLegacy | null; error: { code?: string } | null }>,
): Promise<
  | { data: TFsrs | null; error: { code?: string } | null; usedFsrsColumns: true }
  | { data: TLegacy | null; error: { code?: string } | null; usedFsrsColumns: false }
> {
  if (!schemaReady) {
    const { data, error } = await runLegacyQuery();
    return { data, error, usedFsrsColumns: false };
  }
  const primary = await runFsrsQuery();
  if (isMissingFsrsColumnsError(primary.error)) {
    const fallback = await runLegacyQuery();
    return { data: fallback.data, error: fallback.error, usedFsrsColumns: false };
  }
  return { data: primary.data, error: primary.error, usedFsrsColumns: true };
}
