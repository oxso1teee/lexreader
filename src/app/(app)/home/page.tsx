import { unstable_rethrow } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDueCount } from "@/lib/brain-stats";
import { decidePrimaryAction, dueCountBucket, greetingForHour } from "@/lib/today";
import { getOrCreateSettingsSafe } from "@/lib/language-twin/settings";
import { categoryLabel, reasonLabel } from "@/components/product/language-twin/badges";
import { getOrGenerateActiveMissions } from "@/lib/missions/persist";
import { pickHeroMission } from "@/lib/missions/ranking";
import { findMatchingMissionForSkill } from "@/lib/learning-paths/mission-match";
import { getActivePathStateAction } from "../learning-paths/actions";
import { messages } from "@/lib/i18n";
import { log } from "@/lib/log";
import { fetchStreakWeekMarks } from "@/lib/moments/streak-week-query";
import type { WeekdayMark } from "@/lib/moments/types";
import TodayEveningGate from "@/components/product/today/v7/today-evening-gate";
import DashboardView from "@/components/product/dashboard/dashboard-view";
import { getDailyQuestsSnapshot, type DailyQuestsSnapshot } from "@/lib/daily-quests";
import { DailyQuestsCard } from "@/components/product/quests/daily-quests-card";
import { DoubleXpChip } from "@/components/product/quests/double-xp-chip";
import { computeFirstSteps, shouldShowFirstSteps } from "@/lib/dashboard/first-steps";
import { dailyGoalProgress } from "@/lib/dashboard/goal";
import { firstNameFromMetadata, learningGoalLabel } from "@/lib/dashboard/identity";
import { accountAgeDays, dashboardMode } from "@/lib/dashboard/mode";
import { countSavedWords, countSavedWordsSince } from "@/lib/dashboard/queries";
import { streakDisplay } from "@/lib/dashboard/streak";
import { countSince, lastActivityLabel, readingMinutesSince, summarizeToday } from "@/lib/dashboard/today-summary";
import { buildWantMore } from "@/lib/dashboard/want-more";
import { todayColumn } from "@/lib/dashboard/week";
import InstallBanner from "./install-banner";
import TodayAnalytics from "./today-analytics";
import type { MissionRow, MissionType } from "@/lib/missions/types";
import type { PatternRow } from "@/lib/language-twin/types";

const t = messages.today;

const SEVERITY_WEIGHT: Record<"high" | "medium" | "low", number> = { high: 3, medium: 2, low: 1 };

const GRAMMAR_RUNNER_TYPES = new Set<MissionType>(["grammar_pattern", "correction", "diagnostic_followup", "maintenance"]);

// Честный заголовок из реальных полей миссии, без выдуманных под-тем.
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

// Today-evening.dc.html — "Спасти стрик · N мин": то же число минут, что уже
// показано в hero.meta ("~N мин"), не вторая независимая оценка.
function extractMinutesHint(meta: string[]): number | null {
  for (const m of meta) {
    const match = m.match(/~?(\d+)\s*мин/);
    if (match) return Number(match[1]);
  }
  return null;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// День активности — по UTC, как у activity_days, vocabulary.ts и daily-quests.
function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// /home — главный экран «Сегодня» (Phase 2, WP2). Страница считает данные из
// реальных таблиц и отдаёт готовую модель в DashboardView; решение «что
// предложить первым» (миссия > повтор > чтение > добавить материал) и
// приоритеты Learning Paths остались прежними — меняется только раскладка и
// состояния: first-day (чек-лист первых шагов), regular, goal-done.
//
// Необязательные блоки (миссии, путь, задания, неделя, счётчики слов) не
// должны ронять всю страницу: сбой такого блока логируется, блок
// подменяется пустым значением, а вверху появляется предупреждение. Профиль
// и авторизация обязательны — их ошибка по-прежнему уходит в error.tsx.
export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const now = new Date();
  const sevenDaysAgo = daysAgo(7).toISOString();
  const todayStartIso = todayStartUtc();
  const todayStartMs = new Date(todayStartIso).getTime();

  const failed: string[] = [];
  function settled<T>(label: string, promise: PromiseLike<T>, fallback: T): Promise<T> {
    return Promise.resolve(promise).catch((error: unknown) => {
      // redirect()/notFound() и запросные API Next сигналят служебными
      // исключениями — их нельзя проглатывать (docs: unstable_rethrow).
      unstable_rethrow(error);
      failed.push(label);
      log.error({ kind: "home_block", message: `${label}: ${error instanceof Error ? error.message : "unknown"}` });
      return fallback;
    });
  }
  const fallbackWeek: WeekdayMark[] = Array.from({ length: 7 }, (_, i) => (i === todayColumn(now) ? "today" : "empty"));

  const [
    dueCount,
    continueResult,
    missions,
    twinSettings,
    pendingResult,
    sessionsResult,
    reviewsResult,
    dayResult,
    activePathState,
    dailyQuestsSnapshot,
    savedWords,
    savedWordsToday,
    streakWeek,
    userResult,
  ] = await Promise.all([
    getDueCount(supabase, profile.id, profile.target_language),
    supabase
      .from("text_progress")
      .select("percent_read, last_read_at, texts!inner(id, title, language, owner_id, youtube_video_id)")
      .eq("owner_id", profile.id)
      .eq("texts.language", profile.target_language)
      .gt("percent_read", 4)
      .lt("percent_read", 96)
      .order("last_read_at", { ascending: false })
      .limit(1),
    settled<MissionRow[]>("Миссии", getOrGenerateActiveMissions(supabase, profile.id, profile.target_language), []),
    getOrCreateSettingsSafe(supabase, profile.id),
    supabase
      .from("language_recommendations")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("status", "pending"),
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
    // Цель дня считается в XP (activity_days), не в новых словах.
    supabase.from("activity_days").select("xp").eq("user_id", profile.id).eq("day", todayStartIso.slice(0, 10)).maybeSingle(),
    settled("Учебный путь", getActivePathStateAction(), null),
    settled<DailyQuestsSnapshot | null>(
      "Задания дня",
      getDailyQuestsSnapshot(supabase, profile.id, profile.target_language),
      null,
    ),
    settled("Сохранённые слова", countSavedWords(supabase, profile.id, profile.target_language), 0),
    settled("Слова за сегодня", countSavedWordsSince(supabase, profile.id, profile.target_language, todayStartIso), 0),
    settled("Неделя", fetchStreakWeekMarks(supabase, profile.id, now), fallbackWeek),
    supabase.auth.getUser(),
  ]);

  if (continueResult.error) failed.push("Продолжить чтение");
  if (dayResult.error) failed.push("Прогресс за день");

  const continuingRow = continueResult.data?.[0] as
    | {
        percent_read: number;
        texts:
          | { id: string; title: string; youtube_video_id: string | null }
          | { id: string; title: string; youtube_video_id: string | null }[];
      }
    | undefined;
  const continueTextRaw = continuingRow
    ? (Array.isArray(continuingRow.texts) ? continuingRow.texts[0] : continuingRow.texts)
    : null;
  const continueReading = continueTextRaw
    ? { textId: continueTextRaw.id, title: continueTextRaw.title, percentRead: continuingRow!.percent_read }
    : null;
  // Только для обложки карточки «Продолжить» (мотив «video»);
  // decidePrimaryAction получает прежнюю форму continueReading.
  const continueIsVideo = Boolean(continueTextRaw?.youtube_video_id);

  const primaryAction = decidePrimaryAction({ dueCount, continueReading });

  // Профиль имени не хранит: оно есть только у входивших через Google/Apple.
  const user = userResult.data.user;
  const firstName = firstNameFromMetadata(user?.user_metadata);
  const serverGreeting = greetingForHour(now.getHours());

  // Причина миссии — только из реальных полей: evidence_count паттерна или
  // тот же reasonLabel(), что и на странице миссии. Числа не выдумываем.
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

  // Единая форма данных для hero — миссия > повтор > чтение > добавить материал.
  const heroCardData = heroMission
    ? {
        eyebrow: "Твой следующий шаг",
        title: heroHeadline(heroMission),
        subtitle: heroReasonText ?? `~${heroMission.estimated_minutes} мин`,
        ctaLabel: heroMission.status === "started" ? t.hero.continueCta : t.hero.startCta,
        href: `/missions/${heroMission.id}`,
        actionType: "mission" as const,
        meta: [`~${heroMission.estimated_minutes} мин`, ...(heroReasonText ? [heroReasonText] : [])],
      }
    : primaryAction.type === "review"
      ? {
          eyebrow: t.primaryAction.reviewEyebrow,
          title: `${primaryAction.dueCount} к повторению`,
          subtitle: undefined,
          ctaLabel: t.primaryAction.reviewCta,
          href: "/brain/all/review",
          actionType: "review" as const,
          meta: [`${primaryAction.dueCount} карточек`, `~${Math.max(1, Math.round(primaryAction.dueCount / 4))} мин`],
        }
      : primaryAction.type === "continue_reading"
        ? {
            eyebrow: t.primaryAction.continueEyebrow,
            title: primaryAction.title,
            subtitle: `${primaryAction.percentRead}% прочитано`,
            ctaLabel: t.primaryAction.continueCta,
            href: `/read/${primaryAction.textId}`,
            actionType: "continue_reading" as const,
            meta: [`${primaryAction.percentRead}% прочитано`],
          }
        : {
            eyebrow: undefined,
            title: t.primaryAction.addMaterialTitle,
            subtitle: t.primaryAction.addMaterialDescription,
            ctaLabel: t.primaryAction.addMaterialCta,
            href: "/library/new",
            actionType: "add_material" as const,
            meta: [] as string[],
          };

  // «Мой английский»: до двух реальных паттернов, только при включённом
  // Language Twin (тот же флаг, что использует сам Language Twin).
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

  // Learning Paths не спорят с hero: либо подпись «Из твоего пути», если миссия
  // совпала с фокусом пути, либо один компактный блок продолжения.
  const focusSkill = activePathState?.focusSkill ?? null;
  const heroMatchesPath = Boolean(
    heroMission && focusSkill && findMatchingMissionForSkill([heroMission], focusSkill)?.id === heroMission.id,
  );
  const pathLevelLabel = activePathState ? `${activePathState.path.levelFrom} → ${activePathState.path.levelTo}` : null;
  const showPathCard = Boolean(activePathState && focusSkill && !heroMatchesPath);

  // Данные дня: цель, серия, режим экрана.
  const activitySessions = sessionsResult.data ?? [];
  const activityReviews = reviewsResult.data ?? [];
  const xpToday = dayResult.data?.xp ?? 0;
  const goal = dailyGoalProgress(xpToday, profile.daily_xp_goal);
  const streak = streakDisplay(
    {
      streakCurrent: profile.streak_current,
      lastActiveDate: profile.last_active_date,
      freezeAvailable: profile.streak_freeze_available,
      freezeWeek: profile.streak_freeze_week,
    },
    now,
  );

  // Первые шаги: окна «за 7 дней» покрывают всю историю молодого аккаунта.
  const firstSteps = computeFirstSteps({
    hasRead: activitySessions.length > 0 || continueReading !== null,
    savedWords,
    hasReviewed: activityReviews.length > 0,
    dueCount,
  });
  const showFirstSteps = shouldShowFirstSteps(firstSteps, accountAgeDays(profile.created_at, now));
  const mode = dashboardMode({
    goalDone: goal.done,
    xp: profile.xp,
    firstStepsVisible: showFirstSteps,
    firstStepsDone: firstSteps.doneCount,
  });

  const level = profile.level ?? profile.self_reported_cefr;
  const langCode = profile.target_language.slice(0, 2).toUpperCase();

  const hero = {
    eyebrow: heroCardData.eyebrow,
    title: heroCardData.title,
    // Подзаголовок нужен только там, где meta пуста (добавить материал):
    // у миссии, повтора и чтения те же сведения уже стоят в meta.
    subtitle: heroCardData.actionType === "add_material" ? heroCardData.subtitle : undefined,
    meta: heroCardData.meta,
    ctaLabel: heroCardData.ctaLabel,
    href: heroCardData.href,
    actionType: heroCardData.actionType,
    footnote: heroMatchesPath && pathLevelLabel ? `Из твоего пути: ${pathLevelLabel}` : undefined,
  };

  const summary = summarizeToday({
    readingMinutes: readingMinutesSince(activitySessions, todayStartMs),
    reviews: countSince(
      activityReviews.map((r) => r.reviewed_at as string),
      todayStartMs,
    ),
    newWords: savedWordsToday,
  });

  const questsCard =
    dailyQuestsSnapshot && !(dailyQuestsSnapshot.allComplete && dailyQuestsSnapshot.chestClaimedToday) ? (
      <DailyQuestsCard
        defs={dailyQuestsSnapshot.defs}
        progress={dailyQuestsSnapshot.progress}
        allComplete={dailyQuestsSnapshot.allComplete}
        chestClaimedToday={dailyQuestsSnapshot.chestClaimedToday}
      />
    ) : null;

  return (
    <TodayEveningGate
      xpToday={xpToday}
      streak={streak.value}
      streakLongest={profile.streak_longest}
      xp={profile.xp}
      langCode={langCode}
      level={level}
      week={streakWeek}
      freezeAvailable={profile.streak_freeze_available}
      reviewHref={heroCardData.href}
      reviewMinutesHint={extractMinutesHint(heroCardData.meta)}
    >
      <DashboardView
        mode={mode}
        analytics={
          <TodayAnalytics
            dueCountBucket={dueCountBucket(dueCount)}
            hasActiveMaterial={continueReading !== null}
            missionCount={missions.length}
          />
        }
        installBanner={<InstallBanner />}
        boostChip={profile.xp_boost_until ? <DoubleXpChip boostUntil={profile.xp_boost_until} /> : null}
        questsCard={questsCard}
        notices={failed}
        serverGreeting={serverGreeting}
        firstName={firstName}
        email={user?.email ?? null}
        langCode={langCode}
        level={level}
        xp={profile.xp}
        streak={{ value: streak.value, longest: profile.streak_longest, state: streak.state }}
        goal={goal}
        summary={summary}
        dueCount={dueCount}
        week={streakWeek}
        todayColumn={todayColumn(now)}
        learningGoal={learningGoalLabel(profile.primary_goal)}
        pathLabel={pathLevelLabel}
        hero={hero}
        continueReading={continueReading}
        continueIsVideo={continueIsVideo}
        lastActivity={lastActivityLabel(profile.last_active_date, now)}
        path={
          showPathCard && activePathState && focusSkill
            ? {
                href: `/learning-paths/${activePathState.path.slug}`,
                label: pathLevelLabel ?? "",
                title: focusSkill.title,
                percent: activePathState.contentProgressPercent,
              }
            : null
        }
        showPathInvite={!activePathState && mode !== "first-day" && !failed.includes("Учебный путь")}
        firstSteps={showFirstSteps ? firstSteps : null}
        wantMore={
          mode === "goal-done"
            ? buildWantMore({
                hero: {
                  eyebrow: heroCardData.eyebrow,
                  title: heroCardData.title,
                  subtitle: heroCardData.meta.length > 0 ? heroCardData.meta.join(" · ") : heroCardData.subtitle,
                  ctaLabel: heroCardData.ctaLabel,
                  href: heroCardData.href,
                  actionType: heroCardData.actionType,
                },
                continueReading,
                dueCount,
              })
            : []
        }
        pendingRecommendationsCount={pendingResult.count ?? 0}
        topPatterns={topPatterns}
      />
    </TodayEveningGate>
  );
}
