import {
  QUESTS_PER_DAY,
  QUEST_TYPES,
  allQuestsComplete,
  buildQuestItems,
  isQuestType,
  questProgressFromActivity,
  type DailyQuestDef,
  type DailyQuestItem,
  type DailyQuestProgress,
  type DailyQuestType,
} from "./daily-quests-model.ts";
import { loadDailyActivity, longestCorrectRun, type DailyActivity } from "./goals/activity.ts";
import { READY_LANGUAGES } from "./languages.ts";
import type { SupabaseServerClient } from "./supabase/server.ts";
import { createServiceClient } from "./supabase/service.ts";
import { addDays, userClock, type UserClock } from "./user-day.ts";
import { awardXp, type AwardOutcome } from "./xp/award.ts";
import { rewardsPhase, type RewardsPhase } from "./xp/rollout.ts";
import { XP_SOURCES } from "./xp/sources.ts";

// docs/moments/ROADMAP.md, этап 5 — Daily-quests: 3 задания дня, отдельно от
// недельных миссий (src/lib/missions). Iteration 6 расширила модуль, не создавая
// второй системы заданий:
//   • день — локальный день пользователя (profiles.timezone, user-day.ts);
//   • состав дня детерминирован от (пользователь, день): параллельные первые
//     заходы генерируют ОДИНАКОВЫЙ набор, а не гоняются через Math.random;
//   • в «заданиях-вызовах» добавились типы по урокам, упражнениям и XP;
//   • прогресс — из тех же фактов, что и дневная цель (goals/activity.ts);
//   • награда (сундук) начисляется через единый журнал XP по ключу «день»:
//     дважды забрать нельзя, даже при гонке двух вкладок.

// Типы, названия и статусы заданий (чистая модель) живут в daily-quests-model.ts и
// реэкспортируются отсюда — клиентские компоненты импортируют модель напрямую.
export * from "./daily-quests-model.ts";

interface TargetRange {
  min: number;
  max: number;
  /** Цели кратны шагу (30, 40, 50 XP), а не «37 XP». */
  step: number;
}

// Диапазоны целей — лейбл-допущение (роадмап не называет конкретные числа,
// только параметризует "N минут"/"N слов"/"N подряд"): ориентир — числа из
// самого макета Daily-quests.dc.html (10 минут/15 слов/5 подряд) как центр
// разброса, не единственно верные значения. Новые типы подобраны так, чтобы
// набор оставался посильным за 10–15 минут занятия.
const TARGET_RANGES: Readonly<Record<DailyQuestType, TargetRange>> = {
  read_minutes: { min: 5, max: 15, step: 1 },
  review_words: { min: 10, max: 20, step: 1 },
  combo_streak: { min: 3, max: 7, step: 1 },
  earn_xp: { min: 30, max: 80, step: 10 },
  complete_lessons: { min: 1, max: 2, step: 1 },
  answer_exercises: { min: 8, max: 20, step: 2 },
};

/** Задание-вызов — третье в наборе; первые два (чтение, повторение) постоянны. */
export type ChallengeQuestType = Extract<DailyQuestType, "combo_streak" | "earn_xp" | "complete_lessons" | "answer_exercises">;
const CHALLENGE_POOL: readonly ChallengeQuestType[] = ["combo_streak", "earn_xp", "complete_lessons", "answer_exercises"];
const LESSON_CHALLENGES: readonly ChallengeQuestType[] = ["complete_lessons", "answer_exercises"];

function pickTarget(range: TargetRange, rand: () => number): number {
  const steps = Math.floor((range.max - range.min) / range.step);
  return range.min + Math.floor(rand() * (steps + 1)) * range.step;
}

/** Хэш строки (FNV-1a) → 32-битное зерно. */
function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Детерминированный генератор (mulberry32): одна строка-зерно — одна и та же последовательность. */
export function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Чистая, тестируемая генерация целей — rand() инжектируется в тестах для детерминизма.
 *  Без явного challenge набор прежний: чтение, повторение слов, «верных подряд». */
export function generateQuestTargets(
  rand: () => number = Math.random,
  challenge: ChallengeQuestType = "combo_streak",
): DailyQuestDef[] {
  return [
    { questType: "read_minutes", target: pickTarget(TARGET_RANGES.read_minutes, rand) },
    { questType: "review_words", target: pickTarget(TARGET_RANGES.review_words, rand) },
    { questType: challenge, target: pickTarget(TARGET_RANGES[challenge], rand) },
  ];
}

export interface QuestGenerationOptions {
  /** Есть ли у языка пользователя уроки (иначе задания по урокам/упражнениям не выдаются). */
  lessonsAvailable: boolean;
  /** Идёт выкладка (фаза overlap): живы старые инстансы, чей интерфейс не умеет показывать новые типы
   *  заданий, а check в базе их ещё не допускает (миграция 0060) — выдаём только прежний набор. */
  legacyTypesOnly?: boolean;
}

/** Типы, которые знает и принимает старая версия приложения. */
export const LEGACY_CHALLENGE: ChallengeQuestType = "combo_streak";

export function lessonsAvailableFor(language: string): boolean {
  return READY_LANGUAGES.includes(language);
}

/** Набор дня для пользователя: зависит только от (userId, day, опций) — повторный и
 *  параллельный вызовы дают тот же набор. */
export function generateDailyQuests(userId: string, day: string, options: QuestGenerationOptions): DailyQuestDef[] {
  const rand = seededRandom(`${userId}:${day}`);
  if (options.legacyTypesOnly) return generateQuestTargets(rand, LEGACY_CHALLENGE);
  const pool = options.lessonsAvailable ? CHALLENGE_POOL : CHALLENGE_POOL.filter((t) => !LESSON_CHALLENGES.includes(t));
  const challenge = pool[Math.floor(rand() * pool.length)] ?? "combo_streak";
  return generateQuestTargets(rand, challenge);
}

/** docs/moments/mockups/Daily-quests.dc.html — "5 верных подряд": самая
 *  длинная последовательность grade>=2 в хронологическом порядке. Чистая
 *  функция — вызывающий код сам решает, за какой период брать grades. */
export const longestCorrectStreak: (grades: readonly number[]) => number = longestCorrectRun;

// ---------- хранение набора дня ----------

function sortDefs(defs: DailyQuestDef[]): DailyQuestDef[] {
  return [...defs].sort((a, b) => QUEST_TYPES.indexOf(a.questType) - QUEST_TYPES.indexOf(b.questType));
}

// Не больше QUESTS_PER_DAY: если два параллельных первых захода пришлись на переход overlap → live и
// сгенерировали разные наборы, в базе окажется четыре строки; сортировка по QUEST_TYPES ставит прежние
// типы первыми, поэтому лишний (новый) отбрасывается одинаково для всех читателей.
function rowsToDefs(rows: ReadonlyArray<{ quest_type: string; target: number }> | null): DailyQuestDef[] {
  return sortDefs((rows ?? []).filter((r) => isQuestType(r.quest_type)).map((r) => ({ questType: r.quest_type as DailyQuestType, target: r.target }))).slice(0, QUESTS_PER_DAY);
}

// Идемпотентно: если на day уже есть набор — возвращает его как есть (цели дня не
// должны "подкручиваться" повторным заходом на страницу). Гонка двух параллельных
// первых заходов безопасна дважды: генератор детерминирован (оба пишут одно и то
// же), а unique(owner_id, day, quest_type) в миграции не даёт лишних строк —
// upsert с ignoreDuplicates проигрывает гонку молча, финальный select читает то,
// что реально легло в БД.
export async function getOrGenerateDailyQuests(
  supabase: SupabaseServerClient,
  ownerId: string,
  day: string,
  language: string,
  /** Фаза выкладки; по умолчанию читается из базы (с кэшем). */
  phase?: RewardsPhase,
): Promise<DailyQuestDef[]> {
  const { data: existing } = await supabase.from("daily_quests").select("quest_type, target").eq("owner_id", ownerId).eq("day", day);
  const current = rowsToDefs(existing);
  if (current.length >= QUESTS_PER_DAY) return current;

  const legacyTypesOnly = (phase ?? (await rewardsPhase())) !== "live";
  const defs = generateDailyQuests(ownerId, day, { lessonsAvailable: lessonsAvailableFor(language), legacyTypesOnly });
  await supabase
    .from("daily_quests")
    .upsert(
      defs.map((d) => ({ owner_id: ownerId, day, quest_type: d.questType, target: d.target })),
      { onConflict: "owner_id,day,quest_type", ignoreDuplicates: true },
    );

  const { data: final } = await supabase.from("daily_quests").select("quest_type, target").eq("owner_id", ownerId).eq("day", day);
  return rowsToDefs(final);
}

// ---------- снимок для экранов ----------

export interface DailyQuestsSnapshot {
  day: string;
  defs: DailyQuestDef[];
  progress: DailyQuestProgress;
  items: DailyQuestItem[];
  allComplete: boolean;
  /** Награда за сегодняшний набор уже получена. */
  chestClaimedToday: boolean;
  /** Активность, из которой посчитан прогресс — главный экран берёт из неё же цель дня. */
  activity: DailyActivity;
}

async function chestClaimedDays(supabase: SupabaseServerClient, userId: string, days: readonly string[], profileClaimedDate: string | null): Promise<Set<string>> {
  const claimed = new Set<string>();
  if (profileClaimedDate && days.includes(profileClaimedDate)) claimed.add(profileClaimedDate);
  if (days.length === 0) return claimed;
  const { data } = await supabase.from("xp_events").select("ref").eq("user_id", userId).eq("source", "quest_chest").in("ref", [...days]);
  for (const row of (data ?? []) as Array<{ ref: string | null }>) if (row.ref) claimed.add(row.ref);
  return claimed;
}

export async function getDailyQuestsSnapshot(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  options: {
    clock?: UserClock;
    /** Уже загруженная активность дня (главный экран грузит её один раз для цели и заданий). */
    activity?: DailyActivity;
    /** Фаза выкладки (по умолчанию читается из базы): влияет на набор типов заданий и на поправку XP дня. */
    phase?: RewardsPhase;
  } = {},
): Promise<DailyQuestsSnapshot> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_quest_chest_claimed_date, timezone")
    .eq("id", ownerId)
    .maybeSingle();
  const profileRow = profile as { daily_quest_chest_claimed_date: string | null; timezone: string | null } | null;
  const dayClock = options.clock ?? userClock(profileRow?.timezone ?? null);
  const today = dayClock.today;

  const [defs, activity, claimed] = await Promise.all([
    getOrGenerateDailyQuests(supabase, ownerId, today, language, options.phase),
    options.activity && options.activity.day === today
      ? Promise.resolve(options.activity)
      : loadDailyActivity(supabase, ownerId, language, today, dayClock.timezone, options.phase),
    chestClaimedDays(supabase, ownerId, [today], profileRow?.daily_quest_chest_claimed_date ?? null),
  ]);
  const progress = questProgressFromActivity(activity);
  const claimedToday = claimed.has(today);
  return {
    day: today,
    defs,
    progress,
    items: buildQuestItems(defs, progress, { day: today, today, claimed: claimedToday }),
    allComplete: allQuestsComplete(defs, progress),
    chestClaimedToday: claimedToday,
    activity,
  };
}

export interface PastQuestDay {
  day: string;
  items: DailyQuestItem[];
  claimed: boolean;
}

/** Наборы прошлых дней (только те, что были выданы): награда получена или задания истекли. */
export async function getRecentQuestDays(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  clock: UserClock,
  count = 3,
  phase?: RewardsPhase,
): Promise<PastQuestDay[]> {
  const days = Array.from({ length: count }, (_, i) => addDays(clock.today, -(i + 1)));
  const { data: rows } = await supabase
    .from("daily_quests")
    .select("day, quest_type, target")
    .eq("owner_id", ownerId)
    .in("day", days);
  const byDay = new Map<string, Array<{ quest_type: string; target: number }>>();
  for (const row of (rows ?? []) as Array<{ day: string; quest_type: string; target: number }>) {
    byDay.set(row.day, [...(byDay.get(row.day) ?? []), row]);
  }
  const present = days.filter((d) => (byDay.get(d)?.length ?? 0) > 0);
  if (present.length === 0) return [];

  const { data: profile } = await supabase.from("profiles").select("daily_quest_chest_claimed_date").eq("id", ownerId).maybeSingle();
  const [claimed, activities] = await Promise.all([
    chestClaimedDays(supabase, ownerId, present, (profile as { daily_quest_chest_claimed_date: string | null } | null)?.daily_quest_chest_claimed_date ?? null),
    Promise.all(present.map((day) => loadDailyActivity(supabase, ownerId, language, day, clock.timezone, phase))),
  ]);
  return present.map((day, i) => ({
    day,
    claimed: claimed.has(day),
    items: buildQuestItems(rowsToDefs(byDay.get(day) ?? []), questProgressFromActivity(activities[i]), { day, today: clock.today, claimed: claimed.has(day) }),
  }));
}

// ---------- сундук ----------

// docs/moments/mockups/Chest.dc.html — "+30 XP, +1 заморозка, ×2 на 15 минут".
export const CHEST_XP = XP_SOURCES.quest_chest.amount ?? 30;
export const CHEST_BOOST_MINUTES = 15;

export interface ClaimChestResult {
  ok: boolean;
  error?: string;
  xpAwarded?: number;
  boostUntil?: string;
}

export interface ChestProfile {
  /** daily_quest_chest_claimed_date — прежний сторож, остаётся для аккаунтов до журнала XP. */
  claimedDate: string | null;
  language: string;
  timezone: string | null;
}

/** Всё, к чему обращается выдача сундука. Настоящая реализация — на Supabase; в тестах — память. */
export interface ChestPorts {
  loadProfile(userId: string): Promise<ChestProfile | null>;
  loadDefs(userId: string, day: string, language: string): Promise<DailyQuestDef[]>;
  loadActivity(userId: string, day: string, language: string, timezone: string): Promise<DailyActivity>;
  /** Начисление XP по ключу «день» — идемпотентно (журнал xp_events). */
  award(userId: string, day: string): Promise<AwardOutcome>;
  /** Условная запись «сундук за day забран» (+ заморозка, Double-XP). true — запись сделал именно этот вызов. */
  markClaimed(userId: string, day: string, boostUntil: string): Promise<boolean>;
}

const ALREADY_OPENED = "Сундук за сегодня уже открыт.";

// Не доверяет клиенту "все задания выполнены" — пересчитывает честно перед
// начислением, как и остальные award-функции проекта. Повторно забрать нельзя:
//   • XP — ключ (quest_chest, день) в журнале XP: второй вызов получает duplicate;
//   • заморозка и Double-XP — условное обновление профиля: выигрывает один вызов.
// Если процесс упал после начисления XP, но до записи профиля, повторный запрос
// получит duplicate, увидит, что отметки нет, и допишет заморозку и буст ровно один раз.
export async function claimChestWith(ports: ChestPorts, userId: string, now: Date = new Date()): Promise<ClaimChestResult> {
  const profile = await ports.loadProfile(userId);
  if (!profile) return { ok: false, error: "Профиль не найден." };
  const clock = userClock(profile.timezone, now);
  const today = clock.today;
  if (profile.claimedDate === today) return { ok: false, error: ALREADY_OPENED };

  const defs = await ports.loadDefs(userId, today, profile.language);
  const activity = await ports.loadActivity(userId, today, profile.language, clock.timezone);
  if (!allQuestsComplete(defs, questProgressFromActivity(activity))) {
    return { ok: false, error: "Не все задания дня выполнены." };
  }

  const outcome = await ports.award(userId, today);
  let xpAwarded: number;
  if (outcome.status === "awarded") xpAwarded = outcome.result.awarded;
  else if (outcome.status === "duplicate") xpAwarded = outcome.awarded;
  else return { ok: false, error: "Не удалось начислить награду." };

  const boostUntil = new Date(now.getTime() + CHEST_BOOST_MINUTES * 60_000).toISOString();
  const won = await ports.markClaimed(userId, today, boostUntil);
  if (!won) return { ok: false, error: ALREADY_OPENED };
  return { ok: true, xpAwarded, boostUntil };
}

function supabaseChestPorts(supabase: SupabaseServerClient, phase?: RewardsPhase): ChestPorts {
  return {
    async loadProfile(userId) {
      const { data } = await supabase
        .from("profiles")
        .select("daily_quest_chest_claimed_date, target_language, timezone")
        .eq("id", userId)
        .maybeSingle();
      const row = data as { daily_quest_chest_claimed_date: string | null; target_language: string; timezone: string | null } | null;
      return row ? { claimedDate: row.daily_quest_chest_claimed_date, language: row.target_language, timezone: row.timezone } : null;
    },
    loadDefs: (userId, day, language) => getOrGenerateDailyQuests(supabase, userId, day, language, phase),
    loadActivity: (userId, day, language, timezone) => loadDailyActivity(supabase, userId, language, day, timezone, phase),
    award: (userId, day) => awardXp(userId, { source: "quest_chest", ref: day }),
    async markClaimed(userId, day, boostUntil) {
      // Сервисной ролью: xp_boost_until и отметка сундука закрыты для записи из браузера
      // (миграция 0059). userId — из серверной сессии вызывающего.
      const { data, error } = await createServiceClient()
        .from("profiles")
        .update({ daily_quest_chest_claimed_date: day, streak_freeze_available: true, xp_boost_until: boostUntil })
        .eq("id", userId)
        // is distinct from: только если отметки за этот день ещё нет (в том числе NULL)
        .or(`daily_quest_chest_claimed_date.is.null,daily_quest_chest_claimed_date.neq.${day}`)
        .select("id");
      return !error && (data?.length ?? 0) > 0;
    },
  };
}

export function claimDailyQuestChest(supabase: SupabaseServerClient, userId: string, now: Date = new Date(), phase?: RewardsPhase): Promise<ClaimChestResult> {
  return claimChestWith(supabaseChestPorts(supabase, phase), userId, now);
}
