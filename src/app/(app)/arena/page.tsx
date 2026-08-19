import { requireProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { buildLeaderboardRows, anonymizedInitials, rankFromHigherCount } from "@/lib/arena";
import { rankForXp } from "@/lib/ranks";
import { avatarInitials } from "@/lib/avatar-initials";
import { getSessionUser } from "@/lib/auth";
import PageHeader from "@/components/product/page-header";

// Gamified redesign — Arena: a REAL global leaderboard ranked by
// profiles.xp (confirmed decision: no follow/friend schema exists, no
// mock data). profiles' RLS is strictly owner-only
// ("id = auth.uid()", supabase/migrations/0001_init.sql), so reading
// OTHER users' xp for ranking needs the service-role client — the same,
// already-established pattern used for cron jobs (src/lib/supabase/
// service.ts) that need to see data across users; never exposed
// client-side. Only `id` and `xp` are read for other users -- no email,
// no PII -- see src/lib/arena.ts for why other rows get a decorative,
// id-derived label instead of anything email-based.
const LEADERBOARD_SIZE = 20;

export default async function ArenaPage() {
  const profile = await requireProfile();
  const user = await getSessionUser();
  const service = createServiceClient();

  const [{ data: topProfiles }, { count: higherCount }] = await Promise.all([
    service.from("profiles").select("id, xp").order("xp", { ascending: false }).limit(LEADERBOARD_SIZE),
    service.from("profiles").select("id", { count: "exact", head: true }).gt("xp", profile.xp),
  ]);

  const rows = buildLeaderboardRows(topProfiles ?? [], profile.id);
  const inTopList = rows.some((r) => r.isCurrentUser);
  const myRealRank = inTopList ? rows.find((r) => r.isCurrentUser)!.rank : rankFromHigherCount(higherCount ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Арена" />
      <p className="text-body-sm text-[var(--text-secondary)]">
        Рейтинг по XP среди всех, кто учится с LexReader.
      </p>

      <div className="rounded-2xl bg-[var(--surface)] shadow-sm">
        {rows.map((row) => (
          <LeaderboardRow
            key={row.id}
            rank={row.rank}
            xp={row.xp}
            label={row.isCurrentUser ? "Ты" : `Игрок ${anonymizedInitials(row.id)}`}
            initials={row.isCurrentUser ? avatarInitials(user?.email ?? "") : anonymizedInitials(row.id)}
            highlighted={row.isCurrentUser}
          />
        ))}
      </div>

      {!inTopList && (
        <div className="rounded-2xl border border-[var(--color-primary)]/40 bg-[var(--surface)] p-3 shadow-sm">
          <LeaderboardRow
            rank={myRealRank}
            xp={profile.xp}
            label="Ты"
            initials={avatarInitials(user?.email ?? "")}
            highlighted
          />
        </div>
      )}

      <p className="text-center text-caption text-[var(--text-secondary)]">
        {rankForXp(profile.xp).title} · {profile.xp} XP
      </p>
    </div>
  );
}

function LeaderboardRow({
  rank,
  xp,
  label,
  initials,
  highlighted,
}: {
  rank: number;
  xp: number;
  label: string;
  initials: string;
  highlighted: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 ${
        highlighted ? "bg-[var(--color-primary)]/10" : ""
      }`}
    >
      <span
        className={`w-6 text-center text-sm font-bold ${
          rank <= 3 ? "text-[var(--color-gold-text)]" : "text-[var(--text-secondary)]"
        }`}
      >
        {rank}
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-muted)] text-xs font-bold">
        {initials}
      </span>
      <span className={`flex-1 text-sm ${highlighted ? "font-bold" : "font-medium"}`}>{label}</span>
      <span className="flex items-center gap-1 text-sm font-semibold text-[var(--color-gold-text)]">
        ⚡{xp}
      </span>
    </div>
  );
}
