import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  getWeeklyLeaderboard,
  describeLeaderboardEmptyState,
  LEADERBOARD_EMPTY_MESSAGE,
  LEADERBOARD_OPT_IN_NUDGE,
} from "@/lib/leaderboard";
import PageHeader from "@/components/product/page-header";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "Соревновательность — недельная лига/лидерборд". Только рендер —
// вся приватность/агрегация уже решена на уровне
// supabase/migrations/0049_weekly_leaderboard.sql (SECURITY DEFINER RPC,
// возвращает только rank/is_you/инициалы/агрегаты за неделю, никогда
// email/сырые строки другого пользователя). Видеть лигу и участвовать в
// ней — два разных решения: таблица показывается всем залогиненным
// (RPC уже отдаёт только тех, кто сам разрешил), приглашение включиться —
// отдельный, не заменяющий таблицу баннер для тех, кто ещё не участвует.
export default async function LeaderboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const rows = await getWeeklyLeaderboard(supabase);
  const emptyReason = describeLeaderboardEmptyState(rows);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Недельная лига" description="Слова и повторения за эту неделю — среди тех, кто сам включил участие." />

      {!profile.leaderboard_opt_in && (
        <section className="rounded-2xl bg-[var(--color-warning)]/10 p-4">
          <p className="text-body-sm text-[var(--color-warning-text)]">{LEADERBOARD_OPT_IN_NUDGE}</p>
          <Link href="/settings" className="focus-ring mt-2 inline-block text-body-sm font-semibold text-[var(--color-forest-text)]">
            Открыть настройки →
          </Link>
        </section>
      )}

      {emptyReason ? (
        <section className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
          <p className="text-body-sm text-[var(--text-secondary)]">{LEADERBOARD_EMPTY_MESSAGE[emptyReason]}</p>
        </section>
      ) : (
        <section className="rounded-2xl bg-[var(--surface)] p-2 shadow-sm">
          <ul className="flex flex-col">
            {rows.map((row) => (
              <li
                key={row.rank}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${row.isYou ? "bg-forest/10" : ""}`}
              >
                <span className="w-6 shrink-0 text-center text-body-sm font-semibold text-[var(--text-secondary)]">
                  {row.rank}
                </span>
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest/15 text-body-sm font-semibold text-[var(--color-forest-text)]"
                >
                  {row.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body-sm font-medium">{row.isYou ? "Ты" : `Участник ${row.initials}`}</p>
                  <p className="text-caption text-[var(--text-secondary)]">
                    {row.wordsCount} слов · {row.reviewsCount} повторений
                  </p>
                </div>
                <span className="shrink-0 text-body-sm font-bold">{row.score}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-caption text-center text-[var(--text-secondary)]">Неделя обновляется каждый понедельник.</p>
    </div>
  );
}
