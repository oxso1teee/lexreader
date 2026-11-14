import type { SupabaseServerClient } from "../supabase/server.ts";
import { dayWindow } from "../user-day.ts";
import { loadPendingXp, type RewardsPhase } from "../xp/rollout.ts";

// Активность пользователя за один локальный день — единый источник прогресса и
// для дневной цели, и для ежедневных заданий. Принцип прежний («хранить факт, а
// не кэш производного числа», 0054): всё считается из фактов — журнала XP
// (activity_days), сессий чтения, журнала повторений и завершённых попыток уроков.
// Поэтому прогресс не «сбрасывается» перезагрузкой, а за любой прошлый день
// считается тем же способом (нужно для истории и «просроченных» заданий).

export interface DailyActivity {
  day: string;
  xp: number;
  readingMinutes: number;
  /** Сколько РАЗНЫХ карточек повторено. */
  reviewedWords: number;
  /** Самая длинная серия верных ответов подряд (grade >= 2) за день. */
  correctStreak: number;
  /** Разные зачтённые уроки (повторное прохождение того же урока не удваивает; проверки знаний не в счёт). */
  lessons: number;
  /** Выполненные упражнения в завершённых попытках (уроки и проверки). */
  exercises: number;
}

export const EMPTY_ACTIVITY: Omit<DailyActivity, "day"> = {
  xp: 0,
  readingMinutes: 0,
  reviewedWords: 0,
  correctStreak: 0,
  lessons: 0,
  exercises: 0,
};

export interface ReadingSessionRow {
  started_at: string;
  ended_at: string | null;
}
export interface ReviewRow {
  flashcard_id: string;
  grade: number;
}
export interface AttemptRow {
  /** lesson — полный урок; check — быстрая проверка знаний (уроком не считается, упражнения — считаются). */
  mode: "lesson" | "check";
  path_slug: string;
  skill_key: string;
  passed: boolean | null;
  correct_count: number;
  incorrect_count: number;
}

/** Самая длинная последовательность верных ответов (grade >= 2) в хронологическом порядке. */
export function longestCorrectRun(grades: readonly number[]): number {
  let best = 0;
  let current = 0;
  for (const grade of grades) {
    current = grade >= 2 ? current + 1 : 0;
    if (current > best) best = current;
  }
  return best;
}

function nonNegativeInt(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Чистая сводка за день из строк фактов. */
export function summarizeActivity(input: {
  day: string;
  xp: number | null | undefined;
  sessions: readonly ReadingSessionRow[];
  reviews: readonly ReviewRow[];
  attempts: readonly AttemptRow[];
}): DailyActivity {
  const readingMs = input.sessions.reduce((sum, s) => {
    if (!s.ended_at) return sum;
    const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
    return Number.isFinite(ms) && ms > 0 ? sum + ms : sum;
  }, 0);

  const passedSkills = new Set<string>();
  let exercises = 0;
  for (const attempt of input.attempts) {
    exercises += nonNegativeInt(attempt.correct_count) + nonNegativeInt(attempt.incorrect_count);
    if (attempt.passed === true && attempt.mode === "lesson") passedSkills.add(`${attempt.path_slug}/${attempt.skill_key}`);
  }

  return {
    day: input.day,
    xp: nonNegativeInt(input.xp),
    readingMinutes: Math.round(readingMs / 60_000),
    reviewedWords: new Set(input.reviews.map((r) => r.flashcard_id)).size,
    correctStreak: longestCorrectRun(input.reviews.map((r) => r.grade)),
    lessons: passedSkills.size,
    exercises,
  };
}

/** Активность за локальный день `day` пользователя с поясом `timezone`. XP дня — из activity_days плюс ещё
 *  не применённые события журнала (фаза overlap выкладки, см. xp/rollout.ts; в live поправки нет). Ошибка
 *  чтения основных фактов пробрасывается (вызывающий решает, как деградировать);
 *  попытки уроков — необязательный источник: если таблицы нет (миграция 0058 не
 *  применена), уроки и упражнения считаются нулём, а не роняют экран. */
export async function loadDailyActivity(
  supabase: SupabaseServerClient,
  userId: string,
  language: string,
  day: string,
  timezone: string,
  phase?: RewardsPhase,
): Promise<DailyActivity> {
  const { startIso, endIso } = dayWindow(day, timezone);
  const [pendingXp, dayRow, sessions, reviews, attempts] = await Promise.all([
    loadPendingXp(supabase, userId, phase),
    supabase.from("activity_days").select("xp").eq("user_id", userId).eq("day", day).maybeSingle(),
    supabase
      .from("reading_sessions")
      .select("started_at, ended_at")
      .eq("owner_id", userId)
      .gte("started_at", startIso)
      .lt("started_at", endIso),
    supabase
      .from("review_log")
      .select("flashcard_id, grade, reviewed_at, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", userId)
      .eq("flashcards.language", language)
      .gte("reviewed_at", startIso)
      .lt("reviewed_at", endIso)
      .order("reviewed_at", { ascending: true }),
    supabase
      .from("lesson_attempts")
      .select("mode, path_slug, skill_key, passed, correct_count, incorrect_count")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", startIso)
      .lt("completed_at", endIso),
  ]);
  if (dayRow.error) throw new Error(`activity_days: ${dayRow.error.message}`);
  if (sessions.error) throw new Error(`reading_sessions: ${sessions.error.message}`);
  if (reviews.error) throw new Error(`review_log: ${reviews.error.message}`);

  return summarizeActivity({
    day,
    xp: ((dayRow.data as { xp: number } | null)?.xp ?? 0) + (pendingXp.byDay.get(day) ?? 0),
    sessions: (sessions.data ?? []) as ReadingSessionRow[],
    reviews: (reviews.data ?? []).map((r) => ({ flashcard_id: r.flashcard_id as string, grade: r.grade as number })),
    attempts: attempts.error ? [] : ((attempts.data ?? []) as AttemptRow[]),
  });
}
