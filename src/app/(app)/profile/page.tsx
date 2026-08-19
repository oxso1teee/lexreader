import Link from "next/link";
import { requireProfile, getSessionUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rankForXp } from "@/lib/ranks";
import { avatarInitials } from "@/lib/avatar-initials";
import PageHeader from "@/components/product/page-header";
import ActivityWeekCard from "@/components/product/progress/activity-week-card";
import AchievementsShelf from "../progress/achievements-shelf";

// Gamified redesign — new stats-forward Profile screen (reference: avatar,
// rank/XP, streak, courses, Following/Followers, "Learning statistics",
// "Achievements", "Edit profile"). Reuses the SAME components/queries
// /progress already established (ActivityWeekCard, AchievementsShelf,
// isoWeekStart pattern) rather than building a second stats system.
// Following/Followers are shown as "Скоро" — there is no follow/friend
// table in the schema (confirmed decision, not a fake number).

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function isoWeekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

export default async function ProfilePage() {
  const profile = await requireProfile();
  const user = await getSessionUser();
  const supabase = await createClient();
  const cutoff7 = daysAgo(7);

  const [
    { count: decksCount },
    { data: earnedAchievements },
    { count: weeklyQuestProgress },
    sessionsLast7Days,
    { count: wordsAddedLast7Days },
    reviewsLast7DaysQuery,
  ] = await Promise.all([
    supabase.from("decks").select("id", { count: "exact", head: true }).eq("owner_id", profile.id),
    supabase.from("user_achievements").select("achievement_id").eq("owner_id", profile.id),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("created_at", isoWeekStart(new Date())),
    supabase
      .from("reading_sessions")
      .select("started_at")
      .eq("owner_id", profile.id)
      .gte("started_at", cutoff7.toISOString()),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("created_at", cutoff7.toISOString()),
    supabase
      .from("review_log")
      .select("reviewed_at, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", profile.id)
      .eq("flashcards.language", profile.target_language)
      .gte("reviewed_at", cutoff7.toISOString()),
  ]);

  const sessions = sessionsLast7Days.data ?? [];
  const reviewsLast7Days = reviewsLast7DaysQuery.data ?? [];
  const readingDaysLast7 = new Set(sessions.map((s) => isoDate(s.started_at))).size;
  const earnedIds = new Set((earnedAchievements ?? []).map((a) => a.achievement_id));
  const rank = rankForXp(profile.xp);
  const email = user?.email ?? "";
  const memberSince = new Date(profile.created_at).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <PageHeader title="Профиль" />

      <section className="rounded-2xl bg-[var(--surface)] p-5 text-center shadow-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-primary)]/15 text-2xl font-bold text-[var(--color-primary)]">
          {avatarInitials(email)}
        </div>
        <p className="mt-3 text-h2 font-bold">{email.split("@")[0] || "Ты"}</p>
        <p className="text-body-sm text-[var(--color-gold-text)]">{rank.title}</p>

        <div className="mt-4 flex justify-center gap-6">
          <Stat value={decksCount ?? 0} label="Колоды" />
          <Stat value={profile.xp} label="XP" icon="⚡" />
          <Stat value={profile.streak_current} label="Стрик, дней" icon="🔥" />
        </div>

        <div className="mt-4 flex justify-center gap-6 text-[var(--text-secondary)]">
          <Stat value="Скоро" label="Подписки" muted />
          <Stat value="Скоро" label="Подписчики" muted />
        </div>

        <p className="mt-3 text-caption text-[var(--text-secondary)]">С LexReader с {memberSince}</p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/settings"
            className="focus-ring flex-1 rounded-full border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold"
          >
            Настройки
          </Link>
          <Link
            href="/progress"
            className="focus-ring flex-1 rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary-foreground)]"
          >
            Мой прогресс
          </Link>
        </div>
      </section>

      <ActivityWeekCard
        data={{
          readingDays: readingDaysLast7,
          sessionsCompleted: sessions.length,
          wordsAdded: wordsAddedLast7Days ?? 0,
          reviewsDone: reviewsLast7Days.length,
        }}
      />

      <AchievementsShelf
        earnedIds={earnedIds}
        weeklyQuestProgress={weeklyQuestProgress ?? 0}
        streakFreezeAvailable={profile.streak_freeze_available}
      />
    </div>
  );
}

function Stat({
  value,
  label,
  icon,
  muted,
}: {
  value: number | string;
  label: string;
  icon?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-h3 font-bold ${muted ? "text-[var(--text-secondary)]" : ""}`}>
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </span>
      <span className="text-caption text-[var(--text-secondary)]">{label}</span>
    </div>
  );
}
