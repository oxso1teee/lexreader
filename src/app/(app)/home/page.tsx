import Link from "next/link";
import { Award, CalendarCheck, RotateCcw, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDueCount } from "@/lib/brain-stats";
import { decidePrimaryAction, dueCountBucket, greetingForHour } from "@/lib/today";
import { getOrCreateSettingsSafe } from "@/lib/language-twin/settings";
import { categoryLabel, reasonLabel } from "@/components/product/language-twin/badges";
import { getOrGenerateActiveMissions, getMissionsCompletedThisWeek } from "@/lib/missions/persist";
import { pickHeroMission } from "@/lib/missions/ranking";
import { findMatchingMissionForSkill } from "@/lib/learning-paths/mission-match";
import { getActivePathStateAction } from "../learning-paths/actions";
import { isoWeekStart } from "@/lib/iso-week";
import { messages } from "@/lib/i18n";
import PageHeader from "@/components/product/page-header";
import SectionHeader from "@/components/product/section-header";
import PrimaryActionCard from "@/components/product/primary-action-card";
import ContinueLearningCard from "@/components/product/today/continue-learning-card";
import DailyPlanCard from "@/components/product/today/daily-plan-card";
import ComingSoonCard from "@/components/product/today/coming-soon-card";
import HeroMissionCard from "@/components/product/today/hero-mission-card";
import StreakHero from "@/components/product/streak-hero";
import InstallBanner from "./install-banner";
import TodayAnalytics from "./today-analytics";
import type { PatternCategory, PatternStatus, PatternRow } from "@/lib/language-twin/types";

const t = messages.today;

const SEVERITY_WEIGHT: Record<"high" | "medium" | "low", number> = { high: 3, medium: 2, low: 1 };
const PATTERN_STATUS_PHRASE: Partial<Record<PatternStatus, string>> = {
  active: "в фокусе",
  improving: "улучшается",
  uncertain: "нужно проверить",
};

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// M3 Slice 1 — редизайн Today (docs/ui/unified-ui-slice-1-plan.md,
// docs/ui/current-ui-audit.md §3): один primary CTA вместо нескольких
// конкурирующих карточек равного веса. PremiumCard/WelcomeCard/tip-карточка
// сюда намеренно не переносятся — "no unrelated upgrade banner" прямо
// входит в acceptance criteria этого слайса; /pricing и Stripe-flow не
// удаляются, просто больше не занимают место на главном экране. Route
// остаётся /home — только композиция страницы меняется.
//
// M3 Slice 7 (Today v2, docs/ui/m3-slice7-today-v2-plan.md): the primary CTA
// slot now prefers a real active Mission (pickHeroMission) over the generic
// review/continue/add-material action — that fallback logic itself is
// unchanged and still renders exactly as before when no mission exists.
export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const sevenDaysAgo = daysAgo(7).toISOString();

  const [
    dueCount,
    { data: continueRows },
    missions,
    twinSettings,
    { count: pendingRecommendationsCount },
    missionWeekStats,
    { data: activitySessions },
    { data: activityReviews },
    { count: newWordsToday },
    activePathState,
  ] = await Promise.all([
    getDueCount(supabase, profile.id, profile.target_language),
    supabase
      .from("text_progress")
      .select("percent_read, last_read_at, texts!inner(id, title, language, owner_id)")
      .eq("owner_id", profile.id)
      .eq("texts.language", profile.target_language)
      .gt("percent_read", 4)
      .lt("percent_read", 96)
      .order("last_read_at", { ascending: false })
      .limit(1),
    getOrGenerateActiveMissions(supabase, profile.id, profile.target_language),
    getOrCreateSettingsSafe(supabase, profile.id),
    supabase
      .from("language_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "pending"),
    getMissionsCompletedThisWeek(supabase, profile.id, isoWeekStart(new Date()).toISOString()),
    supabase.from("reading_sessions").select("started_at").eq("owner_id", profile.id).gte("started_at", sevenDaysAgo),
    supabase
      .from("review_log")
      .select("reviewed_at, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", profile.id)
      .eq("flashcards.language", profile.target_language)
      .gte("reviewed_at", sevenDaysAgo),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("created_at", todayStartUtc()),
    getActivePathStateAction(),
  ]);

  const continuingRow = continueRows?.[0] as
    | { percent_read: number; texts: { id: string; title: string } | { id: string; title: string }[] }
    | undefined;
  const continueTextRaw = continuingRow
    ? (Array.isArray(continuingRow.texts) ? continuingRow.texts[0] : continuingRow.texts)
    : null;
  const continueReading = continueTextRaw
    ? { textId: continueTextRaw.id, title: continueTextRaw.title, percentRead: continuingRow!.percent_read }
    : null;

  const primaryAction = decidePrimaryAction({ dueCount, continueReading });
  const greeting = greetingForHour(new Date().getHours());
  const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(),
  );

  // Today v2 §4: the hero mission's reason line comes from real fields only
  // — the pattern's own evidence_count when one exists, otherwise the same
  // reasonLabel() already used on Mission Details. Never a fabricated count.
  const heroMission = pickHeroMission(missions);
  let heroReasonText: string | null = null;
  if (heroMission) {
    if (heroMission.source_pattern_id) {
      const { data: heroPattern } = await supabase
        .from("language_error_patterns")
        .select("evidence_count")
        .eq("id", heroMission.source_pattern_id)
        .eq("user_id", profile.id)
        .maybeSingle();
      heroReasonText = heroPattern ? `Эта тема встречалась ${heroPattern.evidence_count} раз(а)` : null;
    } else {
      heroReasonText = reasonLabel(heroMission.reason_key);
    }
  }

  // Today v2 §4: compact "Мой английский" — up to 2 real patterns, gated on
  // the same enabled flag Language Twin itself uses (getLanguageTwinEntryState
  // does the identical check) so a disabled profile never leaks pattern data
  // here even though this reads language_error_patterns directly instead of
  // going through that helper (which only ever exposes one focus pattern).
  let topPatterns: Pick<PatternRow, "category" | "title" | "status">[] = [];
  if (twinSettings?.enabled) {
    const { data: patternsData } = await supabase
      .from("language_error_patterns")
      .select("category, title, status, severity")
      .eq("user_id", profile.id)
      .in("status", ["active", "improving", "uncertain"]);
    topPatterns = [...(patternsData ?? [])]
      .sort((a, b) => SEVERITY_WEIGHT[b.severity as "high" | "medium" | "low"] - SEVERITY_WEIGHT[a.severity as "high" | "medium" | "low"])
      .slice(0, 2);
  }

  // M3 Slice 8 §11: Today's hero stays authoritative — Learning Paths never
  // competes with it, only attributes or adds a slim secondary card. Case 1:
  // the hero mission already matches the active Path's current focus skill
  // -> small "Из твоего пути" attribution, no ranking changes. Case 2: no
  // hero relevant to the Path -> one compact secondary card, never a second
  // dashboard section.
  const focusSkill = activePathState?.focusSkill ?? null;
  const heroMatchesPath = Boolean(
    heroMission && focusSkill && findMatchingMissionForSkill([heroMission], focusSkill)?.id === heroMission.id,
  );
  const pathLevelLabel = activePathState ? `${activePathState.path.levelFrom} → ${activePathState.path.levelTo}` : null;
  const showPathSecondaryCard = Boolean(activePathState && focusSkill && !heroMatchesPath);

  const activeDaysThisWeek = new Set([
    ...(activitySessions ?? []).map((s) => isoDate(s.started_at)),
    ...(activityReviews ?? []).map((r) => isoDate(r.reviewed_at)),
  ]).size;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 md:max-w-3xl md:gap-5 md:px-0 md:py-8">
      <TodayAnalytics
        dueCountBucket={dueCountBucket(dueCount)}
        hasActiveMaterial={continueReading !== null}
        missionCount={missions.length}
      />

      <PageHeader title={`${greeting}!`} description={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />

      <InstallBanner />

      <StreakHero days={profile.streak_current} />

      {heroMission ? (
        <>
          <HeroMissionCard mission={heroMission} reasonText={heroReasonText} />
          {heroMatchesPath && pathLevelLabel && (
            <p className="-mt-2 text-xs text-[var(--text-secondary)]">Из твоего пути: {pathLevelLabel}</p>
          )}
        </>
      ) : (
        <>
          {primaryAction.type === "review" && (
            <PrimaryActionCard
              eyebrow={t.primaryAction.reviewEyebrow}
              title={`${primaryAction.dueCount} к повторению`}
              ctaLabel={t.primaryAction.reviewCta}
              href="/brain/all/review"
              actionType="review"
            />
          )}
          {primaryAction.type === "continue_reading" && (
            <PrimaryActionCard
              eyebrow={t.primaryAction.continueEyebrow}
              title={primaryAction.title}
              description={`${primaryAction.percentRead}% прочитано`}
              ctaLabel={t.primaryAction.continueCta}
              href={`/read/${primaryAction.textId}`}
              actionType="continue_reading"
            />
          )}
          {primaryAction.type === "add_material" && (
            <PrimaryActionCard
              title={t.primaryAction.addMaterialTitle}
              description={t.primaryAction.addMaterialDescription}
              ctaLabel={t.primaryAction.addMaterialCta}
              href="/library/new"
              actionType="add_material"
            />
          )}
        </>
      )}

      {showPathSecondaryCard && activePathState && focusSkill && (
        <Link
          href={`/learning-paths/${activePathState.path.slug}`}
          className="focus-ring flex items-center justify-between gap-3 rounded-xl bg-[var(--surface)] p-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs text-[var(--text-secondary)]">Мой путь · {pathLevelLabel}</p>
            <p className="text-body-sm truncate font-medium">{focusSkill.title}</p>
          </div>
          <span className="shrink-0 text-body-sm font-semibold text-[var(--color-forest-text)]">Продолжить →</span>
        </Link>
      )}

      {/* Один герой (стрик выше, основной CTA — hero mission/primary action
          выше) + три-четыре цифры в ряд вместо стопки из четырёх визуально
          одинаковых карточек (DailyGoalRow/ReviewSummaryCard/recommendations-
          card, все — rounded-xl bg-surface p-4 shadow-sm, неотличимые на
          взгляд), которая была здесь раньше. Прогресс недели (activeDays/
          missions) слит в ту же строку — второй похожей строки метрик ниже
          на странице больше нет. */}
      <section className="flex flex-col gap-2">
        <SectionHeader title={t.summary.title} />
        <DailyPlanCard
          metrics={[
            { label: "К повторению", value: String(dueCount), icon: RotateCcw },
            { label: "Дневная цель", value: `${newWordsToday ?? 0}/${profile.daily_word_goal}`, icon: Target },
            { label: t.weekProgress.activeDays, value: String(activeDaysThisWeek), icon: CalendarCheck },
            ...(missionWeekStats.completed > 0
              ? [{ label: t.weekProgress.missionsCompleted, value: String(missionWeekStats.completed), icon: Award }]
              : []),
          ]}
        />
        <ContinueLearningCard material={continueReading} />
        {(pendingRecommendationsCount ?? 0) > 0 && (
          <Link
            href="/language-twin/recommendations"
            className="focus-ring flex items-center justify-between rounded-xl bg-[var(--surface)] p-4 shadow-sm"
          >
            <p className="text-body-sm text-[var(--text-secondary)]">Новых рекомендаций: {pendingRecommendationsCount}</p>
            <span className="text-body-sm font-semibold text-[var(--color-forest-text)]">Открыть →</span>
          </Link>
        )}
      </section>

      {topPatterns.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionHeader title={t.myEnglish.title} />
          <div className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-sm">
            {topPatterns.map((p, i) => (
              <Link key={i} href="/language-twin" className="focus-ring text-sm hover:underline">
                {categoryLabel(p.category as PatternCategory)}
                {" — "}
                {PATTERN_STATUS_PHRASE[p.status] ?? p.title}
              </Link>
            ))}
            <Link
              href="/language-twin"
              className="focus-ring self-start text-xs font-medium text-[var(--color-forest-text)] underline-offset-2 hover:underline"
            >
              Весь профиль →
            </Link>
          </div>
        </section>
      )}

      <ComingSoonCard />
    </div>
  );
}
