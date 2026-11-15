import type { SupabaseServerClient } from "@/lib/supabase/server";
import { isoWeekStart } from "@/lib/iso-week.ts";
import type { WeeklyRankMoment, WeeklyRankPodiumEntry } from "./types.ts";

// docs/moments/ROADMAP.md, этап 6 — Weekly-rank. Показывается в понедельник
// ПРО ЗАКОНЧИВШУЮСЯ неделю — get_weekly_leaderboard_for_week() (0055)
// параметризует неделю вместо текущего хардкода. initials — та же
// двухбуквенная точность, что и везде в приложении (0049), не настоящее имя.
const MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function weekLabel(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + 6 * 86_400_000);
  const sameMonth = weekStart.getUTCMonth() === end.getUTCMonth();
  const startStr = sameMonth ? `${weekStart.getUTCDate()}` : `${weekStart.getUTCDate()} ${MONTHS_RU[weekStart.getUTCMonth()]}`;
  return `${startStr}–${end.getUTCDate()} ${MONTHS_RU[end.getUTCMonth()]}`;
}

interface LastWeekRpcRow {
  rank: number;
  is_you: boolean | null;
  initials: string;
  score: number;
}

export async function maybeBuildWeeklyRankMoment(supabase: SupabaseServerClient, userId: string, now: Date): Promise<WeeklyRankMoment | null> {
  const lastWeekStart = new Date(isoWeekStart(now).getTime() - 7 * 86_400_000);
  const lastWeekStartIso = isoDate(lastWeekStart);

  const { data, error } = await supabase.rpc("get_weekly_leaderboard_for_week", { p_week_start: lastWeekStartIso });
  if (error || !data) return null;
  const rows = (data as LastWeekRpcRow[]).map((r) => ({ rank: r.rank, isYou: r.is_you === true, initials: r.initials, score: r.score }));

  const myRow = rows.find((r) => r.isYou);
  if (!myRow) return null; // не опт-ин или ноль активности на прошлой неделе — честно ничего не показываем

  const podium: WeeklyRankPodiumEntry[] = rows
    .filter((r) => r.rank <= 3)
    .map((r) => ({ rank: r.rank as 1 | 2 | 3, name: r.initials, initial: r.initials, score: r.score }));

  const below = rows.find((r) => r.rank === myRow.rank + 1);
  const rank3 = rows.find((r) => r.rank === 3);

  return {
    kind: "weekly_rank",
    id: `weekly_rank:${lastWeekStartIso}`,
    weekLabel: weekLabel(lastWeekStart),
    myRank: myRow.rank,
    myScore: myRow.score,
    xpGapToNextTier: myRow.rank > 3 && rank3 ? Math.max(0, rank3.score - myRow.score) : null,
    podium,
    rowBelow: below ? { rank: below.rank, name: below.initials, initial: below.initials, score: below.score } : null,
  };
}
