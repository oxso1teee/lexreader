import type { SupabaseServerClient } from "./supabase/server.ts";
import { addXp, todayUtcIso } from "./xp-actions.ts";

// docs/moments/ROADMAP.md, этап 5 — Daily-quests: 3 задания дня, отдельно
// от недельных миссий (src/lib/missions). day везде — UTC-сутки
// (todayUtcIso()), как и activity_days; "по времени пользователя" из
// роадмапа не реализовано — в profiles нет колонки часового пояса.
export type DailyQuestType = "read_minutes" | "review_words" | "combo_streak";

export interface DailyQuestDef {
  questType: DailyQuestType;
  target: number;
}

// Диапазоны целей — лейбл-допущение (роадмап не называет конкретные числа,
// только параметризует "N минут"/"N слов"/"N подряд"): ориентир — числа из
// самого макета Daily-quests.dc.html (10 минут/15 слов/5 подряд) как центр
// разброса, не единственно верные значения.
const READ_MINUTES_RANGE: readonly [number, number] = [5, 15];
const REVIEW_WORDS_RANGE: readonly [number, number] = [10, 20];
const COMBO_STREAK_RANGE: readonly [number, number] = [3, 7];

/** Чистая, тестируемая генерация целей — rand() инжектируется в тестах для детерминизма. */
export function generateQuestTargets(rand: () => number = Math.random): DailyQuestDef[] {
  const pick = ([min, max]: readonly [number, number]) => min + Math.floor(rand() * (max - min + 1));
  return [
    { questType: "read_minutes", target: pick(READ_MINUTES_RANGE) },
    { questType: "review_words", target: pick(REVIEW_WORDS_RANGE) },
    { questType: "combo_streak", target: pick(COMBO_STREAK_RANGE) },
  ];
}

/** docs/moments/mockups/Daily-quests.dc.html — "5 верных подряд": самая
 *  длинная последовательность grade>=2 в хронологическом порядке. Чистая
 *  функция — вызывающий код сам решает, за какой период брать grades. */
export function longestCorrectStreak(grades: readonly number[]): number {
  let best = 0;
  let current = 0;
  for (const g of grades) {
    if (g >= 2) {
      current += 1;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

export interface DailyQuestProgress {
  read_minutes: number;
  review_words: number;
  combo_streak: number;
}

/** progress[d.questType] >= d.target для каждого d — честная проверка "все 3 выполнены". */
export function allQuestsComplete(defs: readonly DailyQuestDef[], progress: DailyQuestProgress): boolean {
  return defs.every((d) => progress[d.questType] >= d.target);
}

function dayBounds(day: string): { start: string; end: string } {
  return { start: `${day}T00:00:00.000Z`, end: `${day}T23:59:59.999Z` };
}

// Идемпотентно: если на day уже есть 3 строки — возвращает их как есть
// (цели дня не должны "подкручиваться" повторным заходом на страницу).
// Гонка двух параллельных первых заходов защищена unique(owner_id, day,
// quest_type) в миграции — upsert с ignoreDuplicates просто проигрывает
// гонку молча, финальный select всегда читает то, что реально легло в БД.
export async function getOrGenerateDailyQuests(
  supabase: SupabaseServerClient,
  ownerId: string,
  day: string,
): Promise<DailyQuestDef[]> {
  const { data: existing } = await supabase
    .from("daily_quests")
    .select("quest_type, target")
    .eq("owner_id", ownerId)
    .eq("day", day);
  if (existing && existing.length === 3) {
    return existing.map((r) => ({ questType: r.quest_type as DailyQuestType, target: r.target }));
  }

  const defs = generateQuestTargets();
  await supabase
    .from("daily_quests")
    .upsert(
      defs.map((d) => ({ owner_id: ownerId, day, quest_type: d.questType, target: d.target })),
      { onConflict: "owner_id,day,quest_type", ignoreDuplicates: true },
    );

  const { data: final } = await supabase
    .from("daily_quests")
    .select("quest_type, target")
    .eq("owner_id", ownerId)
    .eq("day", day);
  return (final ?? []).map((r) => ({ questType: r.quest_type as DailyQuestType, target: r.target }));
}

// reading_sessions.minutes и activity_days.minutes никогда не заполняются
// в проекте (проверено: ни один write-путь не трогает эти поля) — минуты
// чтения честно считаются из started_at/ended_at самих сессий за день,
// не из несуществующего кэша.
export async function computeDailyQuestProgress(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  day: string,
): Promise<DailyQuestProgress> {
  const { start, end } = dayBounds(day);
  const [{ data: sessions }, { data: logs }] = await Promise.all([
    supabase
      .from("reading_sessions")
      .select("started_at, ended_at")
      .eq("owner_id", ownerId)
      .gte("started_at", start)
      .lte("started_at", end),
    supabase
      .from("review_log")
      .select("grade, reviewed_at, flashcard_id, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", ownerId)
      .eq("flashcards.language", language)
      .gte("reviewed_at", start)
      .lte("reviewed_at", end)
      .order("reviewed_at", { ascending: true }),
  ]);

  const readMinutes = Math.round(
    (sessions ?? []).reduce((sum, s) => {
      if (!s.ended_at) return sum;
      return sum + (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime());
    }, 0) / 60_000,
  );
  const reviewRows = logs ?? [];
  const reviewWords = new Set(reviewRows.map((r) => r.flashcard_id)).size;
  const comboStreak = longestCorrectStreak(reviewRows.map((r) => r.grade));

  return { read_minutes: readMinutes, review_words: reviewWords, combo_streak: comboStreak };
}

export interface DailyQuestsSnapshot {
  defs: DailyQuestDef[];
  progress: DailyQuestProgress;
  allComplete: boolean;
  /** daily_quest_chest_claimed_date === сегодня — сундук уже забран. */
  chestClaimedToday: boolean;
}

export async function getDailyQuestsSnapshot(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<DailyQuestsSnapshot> {
  const today = todayUtcIso();
  const [defs, { data: profile }] = await Promise.all([
    getOrGenerateDailyQuests(supabase, ownerId, today),
    supabase.from("profiles").select("daily_quest_chest_claimed_date").eq("id", ownerId).single(),
  ]);
  const progress = await computeDailyQuestProgress(supabase, ownerId, language, today);
  return {
    defs,
    progress,
    allComplete: allQuestsComplete(defs, progress),
    chestClaimedToday: profile?.daily_quest_chest_claimed_date === today,
  };
}

// docs/moments/mockups/Chest.dc.html — "+30 XP, +1 заморозка, ×2 на 15 минут".
export const CHEST_XP = 30;
export const CHEST_BOOST_MINUTES = 15;

export interface ClaimChestResult {
  ok: boolean;
  error?: string;
  xpAwarded?: number;
  boostUntil?: string;
}

// Не доверяет клиенту "все задания выполнены" — пересчитывает честно перед
// начислением, как и остальные award-функции проекта (awardPerfectBonus и
// т.п.). daily_quest_chest_claimed_date — тот же сторож-паттерн, что
// perfect_week_awarded_week (0053), от повторного открытия в тот же день.
export async function claimDailyQuestChest(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<ClaimChestResult> {
  const today = todayUtcIso();
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_quest_chest_claimed_date, target_language")
    .eq("id", userId)
    .single();
  if (!profile) return { ok: false, error: "Профиль не найден." };
  if (profile.daily_quest_chest_claimed_date === today) {
    return { ok: false, error: "Сундук за сегодня уже открыт." };
  }

  const defs = await getOrGenerateDailyQuests(supabase, userId, today);
  const progress = await computeDailyQuestProgress(supabase, userId, profile.target_language, today);
  if (!allQuestsComplete(defs, progress)) {
    return { ok: false, error: "Не все задания дня выполнены." };
  }

  const boostUntil = new Date(Date.now() + CHEST_BOOST_MINUTES * 60_000).toISOString();
  const [xpResult] = await Promise.all([
    addXp(supabase, userId, CHEST_XP),
    supabase
      .from("profiles")
      .update({
        daily_quest_chest_claimed_date: today,
        streak_freeze_available: true,
        xp_boost_until: boostUntil,
      })
      .eq("id", userId),
  ]);
  if (!xpResult) return { ok: false, error: "Не удалось начислить награду." };

  return { ok: true, xpAwarded: xpResult.awarded, boostUntil };
}
