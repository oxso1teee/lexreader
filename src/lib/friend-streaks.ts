// docs/moments/ROADMAP.md, этап 6 — Friend-streak: общая серия двух друзей.
// Вся модель — supabase/migrations/0055_duels_rewards_and_friend_streaks.sql
// (friend_streaks: RLS только SELECT для участников, мутации только через
// SECURITY DEFINER-функции ниже — тот же принцип, что у дуэлей/лидерборда).
// Этот файл — тонкие обёртки над RPC + понятные русские сообщения об
// ошибках, зеркалируя src/lib/duel.ts::describeDuelError.

const FRIEND_STREAK_ERROR_MESSAGES: Record<string, string> = {
  invite_not_found: "Приглашение не найдено — возможно, ссылка неверна.",
  invite_already_used: "Это приглашение уже принято.",
  cannot_accept_own_invite: "Нельзя принять собственное приглашение — пришли ссылку другу.",
};

export function describeFriendStreakError(rawMessage: string | null | undefined): string {
  if (!rawMessage) return "Что-то пошло не так, попробуй ещё раз.";
  return FRIEND_STREAK_ERROR_MESSAGES[rawMessage] ?? "Что-то пошло не так, попробуй ещё раз.";
}

// Зеркалирует одну строку friend_streaks (0055) — snapshot-колонки
// *_initials/*_personal_streak, не live join (см. комментарий в миграции).
export interface FriendStreakRow {
  id: string;
  user_a: string;
  user_a_initials: string;
  user_a_personal_streak: number;
  user_b: string | null;
  user_b_initials: string | null;
  user_b_personal_streak: number;
  streak: number;
  last_both_active_day: string | null;
  invite_token: string;
  accepted_at: string | null;
  created_at: string;
}

export interface FriendStreakPartner {
  initial: string;
  personalStreak: number;
}

/** Своя сторона исключена — остаётся только партнёр, независимо от того, user_a я или user_b. */
export function friendStreakPartner(row: FriendStreakRow, userId: string): FriendStreakPartner {
  const iAmA = row.user_a === userId;
  return {
    initial: iAmA ? (row.user_b_initials ?? "…") : row.user_a_initials,
    personalStreak: iAmA ? row.user_b_personal_streak : row.user_a_personal_streak,
  };
}
