import Link from "next/link";
import { Clock, Flame, RotateCcw } from "lucide-react";
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
import { Card, CardLink } from "@/components/ui/card";
import { ReadingCompanion } from "@/components/product/mascot/reading-companion";
import GreetingRow from "@/components/product/today/greeting-row";
import HeroCard from "@/components/product/today/hero-card";
import DailyGoalCard from "@/components/product/today/daily-goal-card";
import MetricCard from "@/components/product/today/metric-card";
import ContinueLearningCard from "@/components/product/today/continue-learning-card";
import QuickActionsCard from "@/components/product/today/quick-actions-card";
import ComingSoonCard from "@/components/product/today/coming-soon-card";
import InstallBanner from "./install-banner";
import TodayAnalytics from "./today-analytics";
import type { MissionRow, MissionType } from "@/lib/missions/types";
import type { PatternCategory, PatternStatus, PatternRow } from "@/lib/language-twin/types";

const t = messages.today;

const SEVERITY_WEIGHT: Record<"high" | "medium" | "low", number> = { high: 3, medium: 2, low: 1 };
const PATTERN_STATUS_PHRASE: Partial<Record<PatternStatus, string>> = {
  active: "в фокусе",
  improving: "улучшается",
  uncertain: "нужно проверить",
};

const GRAMMAR_RUNNER_TYPES = new Set<MissionType>(["grammar_pattern", "correction", "diagnostic_followup", "maintenance"]);

// Ex-hero-mission-card.tsx: честный заголовок из реальных полей миссии,
// без выдуманных под-тем (мокап называет несуществующую категорию
// "Present Continuous Sprint" — мы такую не отслеживаем). Логика не
// менялась, просто переехала сюда вместе с остальной hero-card-раскладкой
// (HeroMissionCard/PrimaryActionCard больше не существуют по отдельности —
// см. hero-card.tsx).
const TARGETED_HEADLINE: Partial<Record<MissionType, string>> = {
  vocab_activation: "Активация слов",
  review_recovery: "Повторение слов",
  phrase_activation: "Активация фраз",
};

function heroHeadline(mission: MissionRow): string {
  if (GRAMMAR_RUNNER_TYPES.has(mission.mission_type) && mission.skill_category) {
    return `Спринт: ${categoryLabel(mission.skill_category)}`;
  }
  return TARGETED_HEADLINE[mission.mission_type] ?? mission.title;
}

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
//
// Композиция под точный визуальный референс (docs/release-2026-08-26/12_...
// уже смерджен, это следующий слой поверх него): вся decision-логика ниже
// (decidePrimaryAction/pickHeroMission/getDueCount/streak/continueReading/
// missions) не тронута — меняется только то, как результат раскладывается
// по экрану. StreakHero (отдельная крупная карточка-огонь) убрана с этого
// экрана — тот же streak_current теперь первая плитка в StatStrip, второго
// места для него в референсе нет (Progress по-прежнему показывает свой
// собственный StreakHero, тот файл не тронут).
//
// redesign/duolingo-flat phase 6: та же логика, новая раскладка — hero-ряд
// (HeroCard + панель с маскотом) и bento-сетка из Card (6 колонок на
// desktop, 2 на мобильном). StatStrip разложен по ячейкам bento; streak
// теперь и чипом в hero, и тёплой ячейкой в сетке.
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
    supabase
      .from("reading_sessions")
      .select("started_at, ended_at")
      .eq("owner_id", profile.id)
      .gte("started_at", sevenDaysAgo),
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

  // Единая форма props для HeroCard — та же decidePrimaryAction/
  // pickHeroMission-развилка, что была раньше (миссия > повтор > чтение >
  // добавить материал), просто приводится к одной форме вместо двух
  // разных компонентов (HeroMissionCard/PrimaryActionCard, см. hero-card.tsx).
  const heroCardData = heroMission
    ? {
        eyebrow: "Твой следующий шаг",
        title: heroHeadline(heroMission),
        subtitle: heroReasonText ?? `~${heroMission.estimated_minutes} мин`,
        ctaLabel: heroMission.status === "started" ? t.hero.continueCta : t.hero.startCta,
        href: `/missions/${heroMission.id}`,
        actionType: "mission" as const,
      }
    : primaryAction.type === "review"
      ? {
          eyebrow: t.primaryAction.reviewEyebrow,
          title: `${primaryAction.dueCount} к повторению`,
          subtitle: undefined,
          ctaLabel: t.primaryAction.reviewCta,
          href: "/brain/all/review",
          actionType: "review" as const,
        }
      : primaryAction.type === "continue_reading"
        ? {
            eyebrow: t.primaryAction.continueEyebrow,
            title: primaryAction.title,
            subtitle: `${primaryAction.percentRead}% прочитано`,
            ctaLabel: t.primaryAction.continueCta,
            href: `/read/${primaryAction.textId}`,
            actionType: "continue_reading" as const,
          }
        : {
            eyebrow: undefined,
            title: t.primaryAction.addMaterialTitle,
            subtitle: t.primaryAction.addMaterialDescription,
            ctaLabel: t.primaryAction.addMaterialCta,
            href: "/library/new",
            actionType: "add_material" as const,
          };

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

  // redesign/duolingo-flat phase 6: те же метрики, что раньше жили в
  // StatStrip, разложены по ячейкам bento. Минуты чтения — единственное
  // новое число, и оно тоже реальное: сумма ended_at − started_at по
  // сессиям, начатым сегодня (reader.tsx/watch-player.tsx пишут их через
  // finishReading(), только для завершённых сессий). Граница "сегодня" —
  // UTC-полночь, как у newWordsToday выше.
  const todayStart = new Date(todayStartUtc()).getTime();
  const readingMinutesToday = (activitySessions ?? []).reduce((sum, s) => {
    const started = new Date(s.started_at).getTime();
    if (started < todayStart || !s.ended_at) return sum;
    return sum + Math.max(0, Math.round((new Date(s.ended_at).getTime() - started) / 60_000));
  }, 0);
  const weekHint =
    activeDaysThisWeek > 0 || missionWeekStats.completed > 0
      ? [
          `${t.weekProgress.activeDays}: ${activeDaysThisWeek}`,
          ...(missionWeekStats.completed > 0 ? [`${t.weekProgress.missionsCompleted}: ${missionWeekStats.completed}`] : []),
        ].join(" · ")
      : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 md:max-w-5xl md:gap-5 md:px-8 md:py-8">
      <TodayAnalytics
        dueCountBucket={dueCountBucket(dueCount)}
        hasActiveMaterial={continueReading !== null}
        missionCount={missions.length}
      />

      <GreetingRow dateLabel={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} greeting={`${greeting}!`} />

      <InstallBanner />

      <div className="grid gap-4 md:grid-cols-2">
        <HeroCard
          eyebrow={heroCardData.eyebrow}
          title={heroCardData.title}
          subtitle={heroCardData.subtitle}
          ctaLabel={heroCardData.ctaLabel}
          href={heroCardData.href}
          actionType={heroCardData.actionType}
          streak={profile.streak_current}
          footnote={heroMatchesPath && pathLevelLabel ? `Из твоего пути: ${pathLevelLabel}` : undefined}
        />
        <div className="flex min-h-[200px] items-center justify-center rounded-[20px] border-2 border-[var(--border-strong)] bg-[var(--leaf-tint)] py-6 md:min-h-[260px]">
          <ReadingCompanion size={140} />
        </div>
      </div>

      <section aria-label={t.summary.title} className="grid grid-cols-2 gap-3 md:grid-cols-6 md:gap-4">
        <DailyGoalCard done={newWordsToday ?? 0} goal={profile.daily_word_goal} className="col-span-2" />
        <MetricCard
          icon={Clock}
          value={String(readingMinutesToday)}
          label="Минут чтения"
          hint="сегодня"
          className="md:col-span-2"
        />
        <MetricCard
          icon={Flame}
          tone="ember"
          value={String(profile.streak_current)}
          label="Дней подряд"
          hint={`Рекорд: ${profile.streak_longest}`}
          className="md:col-span-2"
        />

        <ContinueLearningCard material={continueReading} className="col-span-2 md:col-span-4" />
        <MetricCard
          icon={RotateCcw}
          value={String(dueCount)}
          label="К повторению"
          hint={weekHint}
          className="col-span-2 md:col-span-2"
        />

        <QuickActionsCard className="col-span-2 md:col-span-6" />

        {showPathSecondaryCard && activePathState && focusSkill && (
          <CardLink
            href={`/learning-paths/${activePathState.path.slug}`}
            className="col-span-2 flex items-center justify-between gap-3 md:col-span-6"
          >
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-secondary)]">Мой путь · {pathLevelLabel}</p>
              <p className="text-body-sm truncate font-medium">{focusSkill.title}</p>
            </div>
            <span className="shrink-0 text-body-sm font-semibold text-[var(--color-forest-text)]">Продолжить →</span>
          </CardLink>
        )}

        {(pendingRecommendationsCount ?? 0) > 0 && (
          <CardLink
            href="/language-twin/recommendations"
            className="col-span-2 flex items-center justify-between md:col-span-6"
          >
            <p className="text-body-sm text-[var(--text-secondary)]">Новых рекомендаций: {pendingRecommendationsCount}</p>
            <span className="text-body-sm font-semibold text-[var(--color-forest-text)]">Открыть →</span>
          </CardLink>
        )}

        {topPatterns.length > 0 && (
          <Card className="col-span-2 flex flex-col gap-2 md:col-span-6">
            <h2 className="text-sm font-bold">{t.myEnglish.title}</h2>
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
          </Card>
        )}

        <ComingSoonCard className="col-span-2 md:col-span-6" />
      </section>
    </div>
  );
}
