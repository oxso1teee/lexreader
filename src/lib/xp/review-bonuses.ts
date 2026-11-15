import type { SupabaseServerClient } from "../supabase/server.ts";
import { localDate, userClock, type DayWindow } from "../user-day.ts";

// Серверная проверка наград за повторение. Всё, что нельзя доверить клиенту, доказывается
// журналом review_log (его пишет reviewWord) и закрывается ключом идемпотентности в xp_events
// (уникальный (пользователь, источник, ключ) в БД). Единое понятие — СЕССИЯ.
//
//   СЕССИЯ — самая поздняя серия оценок, где между соседними карточками не больше SESSION_GAP_MS
//   (15 минут). После более длинной паузы начинается новая сессия. Интерфейс применяет то же
//   правило (review-session.tsx), поэтому баннер «5 верных подряд» и выплата совпадают.
//
//   • оценка карточки (review_card): ключ — «день:номер оценки пользователя за этот день».
//     Награда принадлежит месту в журнале, а не строке: отмена последней оценки (undoLastGrade)
//     освобождает место, и новая оценка встаёт на тот же номер — тот же ключ, повторной выплаты
//     нет. Отрицательных начислений нет: журнал XP только пополняется;
//   • серия (combo_bonus): +5 за каждые COMBO_SIZE верных ответов подряд внутри сессии; серия
//     обрывается неверным ответом («Трудно» тоже неверный). Ключ — «первая оценка сессии:позиция
//     карточки, закрывшей блок» — не меняется ни при повторных вызовах, ни при отмене и повторной
//     оценке последней карточки;
//   • идеальная сессия (perfect_session): в сессии не меньше PERFECT_MIN_CARDS карточек и все
//     верные. Ключ — id первой оценки сессии. Клиент не передаёт ни размер, ни границы сессии.
// Верный ответ — grade >= 2 (как и на клиенте: «Помню» / «Легко»).

export const COMBO_SIZE = 5;
export const PERFECT_MIN_CARDS = 5;
/** Пауза между соседними оценками, после которой начинается новая сессия (решение продукта: 15 минут). */
export const SESSION_GAP_MS = 15 * 60_000;
export const CORRECT_GRADE = 2;
/** Сколько часов журнала читать при поиске текущей сессии (сессия через полночь — одна сессия). */
export const RECENT_HOURS = 24;
export const RECENT_LIMIT = 1000;

export interface ReviewLogRow {
  id: string;
  grade: number;
  /** Момент оценки (мс). Сессия определяется по паузам между оценками. */
  at: number;
}

// ---------- сессия ----------

/** Текущая сессия: самый поздний непрерывный отрезок оценок, где пауза между соседними
 *  не больше SESSION_GAP_MS. Порядок во входе не важен. */
export function currentSession(rows: readonly ReviewLogRow[]): ReviewLogRow[] {
  const ordered = [...rows].sort((a, b) => a.at - b.at);
  let start = ordered.length;
  while (start > 0 && (start === ordered.length || ordered[start].at - ordered[start - 1].at <= SESSION_GAP_MS)) start--;
  return ordered.slice(start);
}

// ---------- серия ----------

/** Ключи выплат для каждого завершённого блока из `size` верных подряд в ТЕКУЩЕЙ сессии, по порядку.
 *  Ключ — «id первой оценки сессии:номер позиции карточки, закрывшей блок» (позиция с 1). */
export function comboBlockRefs(rows: readonly ReviewLogRow[], size: number = COMBO_SIZE): string[] {
  const session = currentSession(rows);
  const refs: string[] = [];
  let run = 0;
  session.forEach((row, index) => {
    if (row.grade >= CORRECT_GRADE) {
      run += 1;
      if (run % size === 0) refs.push(`${session[0].id}:${index + 1}`);
    } else {
      run = 0;
    }
  });
  return refs;
}

/** Первый блок серии, за который ещё не начислено; null — все блоки оплачены. */
export function nextUnawardedBlock(blockRefs: readonly string[], awardedRefs: ReadonlySet<string>): string | null {
  return blockRefs.find((ref) => !awardedRefs.has(ref)) ?? null;
}

export interface ComboState {
  /** Сколько верных подряд в текущей сессии. 0 — сессия закончилась (пауза дольше SESSION_GAP_MS) или идёт с ошибки. */
  run: number;
  /** Время последней оценки (мс) — по нему интерфейс сам замечает паузу; null — оценок нет. */
  lastAtMs: number | null;
}

/** Состояние серии «сейчас» — им интерфейс инициализирует счётчик при открытии сессии. */
export function activeComboState(rows: readonly ReviewLogRow[], nowMs: number): ComboState {
  const session = currentSession(rows);
  const last = session[session.length - 1];
  if (!last) return { run: 0, lastAtMs: null };
  if (nowMs - last.at > SESSION_GAP_MS) return { run: 0, lastAtMs: last.at };
  let run = 0;
  for (let i = session.length - 1; i >= 0 && session[i].grade >= CORRECT_GRADE; i--) run += 1;
  return { run, lastAtMs: last.at };
}

// ---------- идеальная сессия ----------

export interface PerfectSession {
  /** Ключ идемпотентности: id первой оценки сессии. */
  ref: string;
  cardCount: number;
  durationSec: number;
}

/** Идеальная ли текущая сессия. Всё, что нужно для решения, берётся из журнала повторений и
 *  серверных констант; вызывающий ничего не сообщает о сессии (лишние аргументы игнорируются). */
export function perfectSession(rows: readonly ReviewLogRow[]): PerfectSession | null {
  const session = currentSession(rows);
  if (session.length < PERFECT_MIN_CARDS) return null;
  if (!session.every((row) => row.grade >= CORRECT_GRADE)) return null;
  const first = session[0];
  const last = session[session.length - 1];
  return { ref: first.id, cardCount: session.length, durationSec: Math.max(1, Math.round((last.at - first.at) / 1000)) };
}

// ---------- место оценки в журнале ----------

/** Ключ XP за оценку карточки: «локальный день:номер оценки пользователя за этот день» (номер с 1). */
export function reviewSlotRef(day: string, position: number): string {
  return `${day}:${position}`;
}

/** День и окно оценки по МЕТКЕ ВРЕМЕНИ ЗАПИСАННОЙ СТРОКИ (её ставит БД), а не по часам приложения.
 *  Иначе оценка, записанная в 23:59:59, а посчитанная приложением уже после полуночи, получила бы
 *  номер 0 в новом дне («D+1:0»). Окно содержит саму строку, поэтому номер всегда ≥ 1. */
export function reviewSlotDay(timezone: string | null | undefined, reviewedAtIso: string): { day: string; window: DayWindow } {
  const clock = userClock(timezone, new Date(reviewedAtIso));
  return { day: clock.today, window: clock.todayWindow };
}

/** Можно ли отменить оценку: только самую последнюю оценку пользователя — как и в интерфейсе.
 *  Если бы отменялись оценки из середины, номера мест сдвигались бы и ключи выплат «уплывали». */
export function isUndoable(latestReviewId: string | null, requestedId: unknown): boolean {
  return typeof requestedId === "string" && latestReviewId !== null && latestReviewId === requestedId;
}

/** Отмена возможна только в тот же локальный день, когда оценка записана. После полуночи место
 *  оценки принадлежало бы прошлому дню, а повторная оценка заняла бы место нового дня и получила
 *  бы XP ещё раз — по одному лишнему XP за каждую полночь. Интерфейс предлагает отмену сразу после
 *  оценки, поэтому на честных пользователях это почти не сказывается. */
export function isSameLocalDay(timezone: string | null | undefined, earlierIso: string, now: Date): boolean {
  const earlier = Date.parse(earlierIso);
  if (!Number.isFinite(earlier)) return false;
  return localDate(new Date(earlier), userClock(timezone, now).timezone) === userClock(timezone, now).today;
}

// ---------- чтение журнала ----------

export interface RecentReviews {
  /** По возрастанию времени. */
  rows: ReviewLogRow[];
  /** Журнал за окно длиннее лимита: самые старые оценки не прочитаны. */
  truncated: boolean;
}

/** Оценки пользователя за последние RECENT_HOURS часов (окно не привязано к локальному дню —
 *  сессия через полночь остаётся одной сессией). Берём самые свежие RECENT_LIMIT. */
export async function loadRecentReviews(supabase: SupabaseServerClient, userId: string, now: Date = new Date()): Promise<RecentReviews> {
  const since = new Date(now.getTime() - RECENT_HOURS * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from("review_log")
    .select("id, grade, reviewed_at, flashcards!inner(owner_id)")
    .eq("flashcards.owner_id", userId)
    .gte("reviewed_at", since)
    .order("reviewed_at", { ascending: false })
    .limit(RECENT_LIMIT);
  if (error) throw new Error(`review_log: ${error.message}`);
  const rows = (data ?? [])
    .map((row) => ({ id: row.id as string, grade: row.grade as number, at: Date.parse(row.reviewed_at as string) }))
    .reverse();
  return { rows, truncated: rows.length >= RECENT_LIMIT };
}

/** Строки текущей сессии или null, если начало сессии не прочитано (журнал обрезан): позиции
 *  в такой сессии определить нельзя, а ошибочный ключ мог бы выплатить блок дважды — не платим. */
export function safeSession(recent: RecentReviews): ReviewLogRow[] | null {
  const session = currentSession(recent.rows);
  if (recent.truncated && session.length === recent.rows.length) return null;
  return session;
}

/** Сколько оценок у пользователя в окне (включая только что записанную) — номер места для reviewSlotRef. */
export async function countReviewsInWindow(supabase: SupabaseServerClient, userId: string, window: DayWindow): Promise<number> {
  const { count, error } = await supabase
    .from("review_log")
    .select("id, flashcards!inner(owner_id)", { count: "exact", head: true })
    .eq("flashcards.owner_id", userId)
    .gte("reviewed_at", window.startIso)
    .lt("reviewed_at", window.endIso);
  if (error) throw new Error(`review_log: ${error.message}`);
  return count ?? 0;
}

/** id самой последней оценки пользователя; null — оценок нет. */
export async function loadLatestReviewId(supabase: SupabaseServerClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("review_log")
    .select("id, flashcards!inner(owner_id)")
    .eq("flashcards.owner_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`review_log: ${error.message}`);
  return (data?.[0]?.id as string | undefined) ?? null;
}

/** Какие из ключей уже выплачены (чтение журнала XP). */
export async function loadAwardedRefs(supabase: SupabaseServerClient, userId: string, source: string, refs: readonly string[]): Promise<Set<string>> {
  if (refs.length === 0) return new Set();
  const { data, error } = await supabase.from("xp_events").select("ref").eq("user_id", userId).eq("source", source).in("ref", [...refs]);
  if (error) throw new Error(`xp_events: ${error.message}`);
  return new Set((data ?? []).map((row) => row.ref as string));
}
