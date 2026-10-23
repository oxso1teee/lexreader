import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getWeeklyLeaderboard } from "@/lib/leaderboard";
import { isoWeekStart } from "@/lib/iso-week.ts";
import type { FriendStreakRow } from "@/lib/friend-streaks.ts";
import type { OvertakenMoment } from "./types.ts";

// docs/moments/ROADMAP.md, этап 6 — Overtaken. get_weekly_leaderboard()
// намеренно никогда не отдаёт id другого пользователя (0049: приватность
// через ЧТО возвращает функция) — только initials/is_you. "Друг" здесь
// сопоставляется по initials его friend_streaks-снимка — тот же уровень
// точности (двухбуквенные инициалы, коллизии возможны), что уже принят во
// всём приложении для межпользовательского отображения (дуэли, лидерборд).
//
// "Обогнал только что" — не "он всегда был выше": сравниваем МОЙ ранг
// сейчас с МОИМ снимком за эту неделю (weekly_rank_snapshots). Если мой
// ранг стал хуже (число увеличилось) И этот друг теперь ровно на строку
// выше меня — считаем, что это он меня обогнал. Первый снимок за неделю
// никогда не триггерит (нет "до", с чем сравнивать) — только создаёт базу.
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchAcceptedPartners(supabase: SupabaseServerClient, userId: string): Promise<{ id: string; initial: string }[]> {
  const { data } = await supabase
    .from("friend_streaks")
    .select("user_a, user_a_initials, user_b, user_b_initials")
    .not("accepted_at", "is", null)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  return ((data ?? []) as Pick<FriendStreakRow, "user_a" | "user_a_initials" | "user_b" | "user_b_initials">[]).map((row) => {
    const iAmA = row.user_a === userId;
    return { id: iAmA ? (row.user_b ?? "") : row.user_a, initial: iAmA ? (row.user_b_initials ?? "?") : row.user_a_initials };
  });
}

export async function checkOvertaken(supabase: SupabaseServerClient, userId: string): Promise<OvertakenMoment[]> {
  const { data: profile } = await supabase.from("profiles").select("leaderboard_opt_in").eq("id", userId).single();
  if (!profile?.leaderboard_opt_in) return [];

  const partners = await fetchAcceptedPartners(supabase, userId);
  if (partners.length === 0) return [];

  const rows = await getWeeklyLeaderboard(supabase);
  const myRow = rows.find((r) => r.isYou);
  if (!myRow) return [];

  const weekStart = isoDate(isoWeekStart(new Date()));
  const { data: snapshot } = await supabase
    .from("weekly_rank_snapshots")
    .select("rank, score")
    .eq("owner_id", userId)
    .eq("week_start", weekStart)
    .maybeSingle();

  const moments: OvertakenMoment[] = [];
  if (snapshot && myRow.rank > snapshot.rank) {
    const overtakerRow = rows.find((r) => r.rank === myRow.rank - 1);
    const overtakerPartner = overtakerRow ? partners.find((p) => p.initial === overtakerRow.initials) : null;
    if (overtakerRow && overtakerPartner) {
      moments.push({
        kind: "overtaken",
        id: `overtaken:${weekStart}:${overtakerRow.rank}`,
        friendName: overtakerPartner.initial,
        friendInitial: overtakerPartner.initial,
        theirRank: overtakerRow.rank,
        xpGapToReclaim: Math.max(0, overtakerRow.score - myRow.score + 1),
        theirScore: overtakerRow.score,
        myScore: myRow.score,
        above: (() => {
          const r = rows.find((x) => x.rank === overtakerRow.rank - 1);
          return r ? { initial: r.initials, score: r.score } : null;
        })(),
      });
    }
  }

  await supabase
    .from("weekly_rank_snapshots")
    .upsert({ owner_id: userId, week_start: weekStart, rank: myRow.rank, score: myRow.score }, { onConflict: "owner_id,week_start" });

  return moments;
}
