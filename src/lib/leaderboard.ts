import type { SupabaseServerClient } from "@/lib/supabase/server";
// Relative import, not the "@/..." alias — leaderboard.test.ts exercises
// describeLeaderboardEmptyState() directly under plain
// `node --experimental-strip-types`, which has no bundler/tsconfig-paths
// resolution for "@/..." at runtime (see extension-tokens.ts's own comment
// on this exact issue).
import { log } from "./log.ts";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Соревновательность — недельная лига/лидерборд". Живая проверка
// (streak.ts, brain-stats.ts, missions/persist.ts) подтвердила: streak уже
// считается на profiles, недельная активность (повторения/миссии) уже
// считается live-запросами с isoWeekStart-границей — но ни одного
// межпользовательского чтения, ни одного "очков за неделю" счётчика в
// проекте не было. supabase/migrations/0049_weekly_leaderboard.sql —
// SECURITY DEFINER RPC, единственная межпользовательская точка чтения во
// всём проекте; вся приватность обеспечена тем, ЧТО возвращает функция
// (rank/is_you/инициалы/агрегаты), а не тем, что доверено вызывающему.
export interface LeaderboardRow {
  rank: number;
  isYou: boolean;
  initials: string;
  reviewsCount: number;
  wordsCount: number;
  score: number;
}

interface LeaderboardRpcRow {
  rank: number;
  is_you: boolean | null;
  initials: string;
  reviews_count: number;
  words_count: number;
  score: number;
}

export async function getWeeklyLeaderboard(supabase: SupabaseServerClient): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase.rpc("get_weekly_leaderboard");
  if (error) {
    log.error({ kind: "weekly_leaderboard_fetch_failed", message: error.message });
    return [];
  }
  return ((data ?? []) as LeaderboardRpcRow[]).map((row) => ({
    rank: row.rank,
    isYou: row.is_you === true,
    initials: row.initials,
    reviewsCount: row.reviews_count,
    wordsCount: row.words_count,
    score: row.score,
  }));
}

export type LeaderboardEmptyReason = "no_activity_yet" | "alone";

// Честная пустая механика (условие задачи) — ни один из этих случаев не
// подставляет ботов/фейковые строки, каждый отображается своим отдельным,
// правдивым текстом вместо одного общего "лидерборд пуст". Не зависит от
// того, включил ли САМ СМОТРЯЩИЙ участие — RPC уже отдал реальные строки
// опт-ин участников независимо от статуса вызывающего (видеть лигу и
// участвовать в ней — два разных решения; см. LEADERBOARD_OPT_IN_NUDGE
// ниже для отдельного, не заменяющего таблицу, приглашения включиться).
export function describeLeaderboardEmptyState(rows: LeaderboardRow[]): LeaderboardEmptyReason | null {
  if (rows.length === 0) return "no_activity_yet";
  if (rows.length === 1 && rows[0]?.isYou) return "alone";
  return null;
}

export const LEADERBOARD_EMPTY_MESSAGE: Record<LeaderboardEmptyReason, string> = {
  no_activity_yet: "На этой неделе пока никто не набрал очков — сделай первое повторение и стань первым.",
  alone: "Пока ты один участник этой недели — пригласи друзей, чтобы было с кем соревноваться.",
};

export const LEADERBOARD_OPT_IN_NUDGE = "Включи участие в настройках, чтобы попасть в лигу самому.";
