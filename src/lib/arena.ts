// Gamified redesign — Arena leaderboard. Pure ranking/display logic,
// separated from the (necessarily service-role, cross-user) DB read in
// src/app/(app)/arena/page.tsx so it's unit-testable without a database.
//
// Privacy: there is no username/avatar/country field in `profiles` (see
// docs/ui/current-ui-audit.md), and reading OTHER users' email (the only
// existing source for initials, via auth.users) to label leaderboard rows
// would be a real new PII exposure. Other users' rows get a decorative,
// deterministic label derived only from their profile id (never their
// email) -- the current user's own row uses their own real email-derived
// initials, since they already know their own email.
export interface LeaderboardEntry {
  id: string;
  xp: number;
}

export interface LeaderboardRow extends LeaderboardEntry {
  rank: number;
  isCurrentUser: boolean;
}

export function buildLeaderboardRows(entries: LeaderboardEntry[], currentUserId: string): LeaderboardRow[] {
  return [...entries]
    .sort((a, b) => b.xp - a.xp)
    .map((entry, index) => ({ ...entry, rank: index + 1, isCurrentUser: entry.id === currentUserId }));
}

/** Deterministic 2-letter decorative label for someone else's row --
 * derived only from their id, never their email/name. */
export function anonymizedInitials(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9]/g, "");
  return (clean.slice(0, 2) || "??").toUpperCase();
}

/** True rank for a user who isn't in the fetched top-N slice, computed
 * from a separate "how many people have more XP than me" count. Never
 * invents a rank inside the visible list when the user isn't really there. */
export function rankFromHigherCount(higherCount: number): number {
  return higherCount + 1;
}
