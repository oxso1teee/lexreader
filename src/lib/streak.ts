import type { SupabaseServerClient } from "./supabase/server.ts";
import { createServiceClient } from "./supabase/service.ts";
import { userClock } from "./user-day.ts";
import { computeStreakUpdate, type StreakProfileSnapshot } from "./streak-engine.ts";
import type { FriendStreakRow } from "./friend-streaks.ts";
import type { FriendStreakMoment } from "./moments/types.ts";

export interface StreakTransition {
  before: number;
  after: number;
  usedFreeze: boolean;
  repairStarted: boolean;
  repairCompleted: boolean;
  repairFailed: boolean;
  milestonesCrossed: number[];
  /** Earn-back: число до обрыва — заполнено только когда repairStarted. */
  streakBeforeBreak: number | null;
  /** Этап 6 — пары, чья общая серия только что увеличилась сегодня. */
  friendStreaks: FriendStreakMoment[];
}

const NO_CHANGE: Omit<StreakTransition, "before" | "after" | "friendStreaks"> = {
  usedFreeze: false,
  repairStarted: false,
  repairCompleted: false,
  repairFailed: false,
  milestonesCrossed: [],
  streakBeforeBreak: null,
};

// docs/moments/ROADMAP.md, этап 6 — Friend-streak. touch_friend_streaks()
// (0055_duels_rewards_and_friend_streaks.sql) возвращает только строки,
// чья ОБЩАЯ серия увеличилась СЕГОДНЯ (идемпотентно — второй вызов в тот же
// день отдаёт пустой массив). Для каждой такой строки строим момент с
// partners = ВСЕ принятые пары этого пользователя (не только та, что
// сработала) — так карточка в макете показывает всех друзей разом, даже
// если сработала только пара с одним из них.
async function buildFriendStreakMoments(supabase: SupabaseServerClient, userId: string, today: string): Promise<FriendStreakMoment[]> {
  const { data: touched } = await supabase.rpc("touch_friend_streaks", { p_day: today });
  const touchedRows = (touched ?? []) as FriendStreakRow[];
  if (touchedRows.length === 0) return [];

  const { data: allRows } = await supabase
    .from("friend_streaks")
    .select("id, user_a, user_a_initials, user_a_personal_streak, user_b, user_b_initials, user_b_personal_streak, streak, last_both_active_day, invite_token, accepted_at, created_at")
    .not("accepted_at", "is", null)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);
  const partnerRows = (allRows ?? []) as FriendStreakRow[];

  return touchedRows.map((row) => {
    const iAmA = row.user_a === userId;
    const primaryPartnerInitial = iAmA ? row.user_b_initials : row.user_a_initials;
    return {
      kind: "friend_streak",
      id: `friend_streak:${row.id}:${today}`,
      sharedStreak: row.streak,
      friendName: primaryPartnerInitial ?? "Друг",
      partners: partnerRows.map((p) => {
        const pIAmA = p.user_a === userId;
        return {
          id: pIAmA ? (p.user_b ?? "") : p.user_a,
          name: pIAmA ? (p.user_b_initials ?? "Друг") : p.user_a_initials,
          initial: pIAmA ? (p.user_b_initials ?? "?") : p.user_a_initials,
          personalStreak: pIAmA ? p.user_b_personal_streak : p.user_a_personal_streak,
        };
      }),
    };
  });
}

// docs/moments/ROADMAP.md, этап 1/2: решение "что произошло" теперь в чистой
// computeStreakUpdate() (src/lib/streak-engine.ts, полностью покрыта
// тестами) — этот файл только читает профиль, передаёт даты и пишет
// результат обратно. usedFreeze/repairStarted/repairCompleted/repairFailed/
// milestonesCrossed — для Freeze-used/Earn-back/Streak-30 моментов
// (collectMoments).
export async function touchStreak(supabase: SupabaseServerClient, userId: string): Promise<StreakTransition | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "streak_current, streak_longest, last_active_date, streak_freeze_available, streak_freeze_week, streak_before_break, streak_repair_until, timezone",
    )
    .eq("id", userId)
    .single();
  if (!profile) return null;

  // День серии — по календарю пользователя (profiles.timezone; пока пояс не
  // известен — UTC, как и раньше), а не по UTC-суткам сервера.
  const { today, yesterday, twoDaysAgo, weekStart: thisWeekStart } = userClock(profile.timezone);

  const snapshot: StreakProfileSnapshot = {
    streakCurrent: profile.streak_current,
    streakLongest: profile.streak_longest,
    lastActiveDate: profile.last_active_date,
    freezeAvailable: profile.streak_freeze_available,
    freezeWeek: profile.streak_freeze_week,
    streakBeforeBreak: profile.streak_before_break,
    repairUntil: profile.streak_repair_until,
  };

  const update = computeStreakUpdate(snapshot, today, yesterday, twoDaysAgo, thisWeekStart);
  if (!update) {
    const friendStreaks = await buildFriendStreakMoments(supabase, userId, today);
    return { before: profile.streak_current, after: profile.streak_current, ...NO_CHANGE, friendStreaks };
  }

  // Поля серии и заморозки принадлежат серверу: клиентской роли запись закрыта (миграция 0060),
  // иначе серию, заморозки и восстановление серии можно было бы выставить запросом из браузера.
  // Пишем сервисной ролью; userId — из серверной сессии вызывающего, а новое значение считает
  // computeStreakUpdate по реальной дате и профилю, а не приходит от клиента.
  const service = createServiceClient();
  await Promise.all([
    service
      .from("profiles")
      .update({
        streak_current: update.streakCurrent,
        streak_longest: update.streakLongest,
        last_active_date: update.lastActiveDate,
        streak_freeze_available: update.freezeAvailable,
        streak_freeze_week: update.freezeWeek,
        streak_before_break: update.streakBeforeBreak,
        streak_repair_until: update.repairUntil,
      })
      .eq("id", userId),
    // Freeze-used-экран: день, который заморозка спасла, нужно реально
    // отметить (иначе Streak-30/Streak-calendar/Today-evening не отличат
    // его от просто пропущенного). Строка почти наверняка ещё не существует
    // (в тот день не было XP) — upsert создаёт её. Запись в activity_days закрыта для
    // клиентской роли (миграция 0060), поэтому — сервисной; userId из серверной сессии.
    update.frozenDay
      ? service.from("activity_days").upsert({ user_id: userId, day: update.frozenDay, freeze_used: true }, { onConflict: "user_id,day" })
      : Promise.resolve(null),
  ]);

  const friendStreaks = await buildFriendStreakMoments(supabase, userId, today);

  return {
    before: update.before,
    after: update.after,
    usedFreeze: update.usedFreeze,
    repairStarted: update.repairStarted,
    repairCompleted: update.repairCompleted,
    repairFailed: update.repairFailed,
    milestonesCrossed: update.milestonesCrossed,
    streakBeforeBreak: update.repairStarted ? update.streakBeforeBreak : null,
    friendStreaks,
  };
}
