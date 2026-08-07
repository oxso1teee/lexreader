import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getDueCount, getReviewsThisWeekCount, computeHardestWords } from "@/lib/brain-stats";
import { decideProgressInsight } from "@/lib/progress-insight";
import { getLanguageTwinEntryState } from "@/lib/language-twin/summary";
import { getMissionsCompletedThisWeek } from "@/lib/missions/persist";
import LanguageTwinSummaryCard from "@/components/product/language-twin/summary-card";
import ActivityHeatmap from "./activity-heatmap";
import PeriodTabs from "./period-tabs";
import StatCard from "./stat-card";
import LineChart from "./line-chart";
import HardestWords from "./hardest-words";
import AchievementsShelf from "./achievements-shelf";
import PersonalRecords from "./personal-records";
import PageHeader from "@/components/product/page-header";
import InsightBanner from "@/components/product/progress/insight-banner";
import ActivityWeekCard from "@/components/product/progress/activity-week-card";
import SkillSection from "@/components/product/progress/skill-section";
import ProgressViewTracker from "./progress-view-tracker";

function isoWeekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - day);
  monday.setUTCHours(0, 0, 0, 0);
  return monday.toISOString();
}

// M3 Slice 4: moved to src/lib/brain-stats.ts (computeHardestWords) so
// Practice Home can reuse the same ranking instead of a second
// implementation — imported above.
const HARDEST_WORDS_LIMIT = 8;

function isoDate(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

function dayLabel(iso: string): string {
  const [, m, day] = iso.split("-");
  return `${day}.${m}`;
}

function buildDayBuckets(days: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(isoDate(d));
  }
  return out;
}

function computeCutoff(period: string): Date | null {
  return period === "all" ? null : new Date(Date.now() - Number(period) * 86_400_000);
}

function computeHeatmapCutoff(): Date {
  return new Date(Date.now() - 91 * 86_400_000);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// Найдено при повторном аудите: для периода "Всё время" chartDays было
// жёстко захардкожено в 30 — график тихо считал только последний месяц,
// хотя карточки статистики выше (wordsReadTotal и т.п.) честно суммируют
// ВСЮ историю без cutoff — два числа для одной и той же метрики на одном
// экране расходились на порядок. Растягиваем график на фактическую историю
// (от самой ранней активности), с разумным потолком.
function computeAllTimeChartDays(earliestTimes: number[]): number {
  if (earliestTimes.length === 0) return 30;
  const daysSinceEarliest = Math.ceil((Date.now() - Math.min(...earliestTimes)) / 86_400_000) + 1;
  return Math.min(365, Math.max(30, daysSinceEarliest));
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period: periodParam } = await searchParams;
  const period = periodParam ?? "30";
  const chartDays = period === "all" ? 30 : Number(period);

  const profile = await requireProfile();
  const supabase = await createClient();

  const cutoff = computeCutoff(period);
  const heatmapCutoff = computeHeatmapCutoff();

  const [
    { count: totalWords },
    { count: knownWords },
    { count: learningWords },
    sessionsQuery,
    flashcardsQuery,
    reviewLogQuery,
    heatmapSessions,
    heatmapReviews,
    accuracyLogQuery,
    { data: earnedAchievements },
    { count: weeklyQuestProgress },
    dueReviewsCount,
    reviewsThisWeek,
    { data: lastReadingRow },
    { count: wordsAddedLast7Days },
    { count: finishedTexts },
    languageTwinState,
    missionWeekStats,
  ] = await Promise.all([
    // P0-АУДИТ 3.9: счётчики слов теперь ограничены текущим изучаемым
    // языком — иначе после смены языка в цифры попадали бы чужие слова.
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .eq("status", "known"),
    // P0-АУДИТ (раздел 4): раньше .neq("status", "known") включал и
    // status='new' (level 0, ни разу не пройденное слово) — завышало
    // "Изучаются (ур. 1-3)". Теперь фильтруем строго по уровню 1-3.
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("level", 1)
      .lte("level", 3),
    (() => {
      let q = supabase
        .from("reading_sessions")
        .select("started_at, words_looked_up")
        .eq("owner_id", profile.id);
      if (cutoff) q = q.gte("started_at", cutoff.toISOString());
      return q;
    })(),
    // Найдено при повторном аудите: у flashcards появилась колонка language
    // (см. миграцию 0018) — счётчики Мозга теперь тоже ограничены текущим
    // target_language, как и счётчики словаря выше.
    (() => {
      let q = supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", profile.id)
        .eq("language", profile.target_language);
      if (cutoff) q = q.gte("created_at", cutoff.toISOString());
      return q;
    })(),
    (() => {
      let q = supabase
        .from("review_log")
        .select("reviewed_at, flashcards!inner(owner_id, language)")
        .eq("flashcards.owner_id", profile.id)
        .eq("flashcards.language", profile.target_language);
      if (cutoff) q = q.gte("reviewed_at", cutoff.toISOString());
      return q;
    })(),
    supabase
      .from("reading_sessions")
      .select("started_at")
      .eq("owner_id", profile.id)
      .gte("started_at", heatmapCutoff.toISOString()),
    supabase
      .from("review_log")
      .select("reviewed_at, flashcards!inner(owner_id, language)")
      .eq("flashcards.owner_id", profile.id)
      .eq("flashcards.language", profile.target_language)
      .gte("reviewed_at", heatmapCutoff.toISOString()),
    // "Сложные слова" — точность слова накопительная за всё время, не
    // зависит от вкладки периода (как и "Изучаются всего"/"Знаю всего" выше).
    supabase
      .from("review_log")
      .select("flashcard_id, grade, flashcards!inner(front, back, owner_id, language)")
      .eq("flashcards.owner_id", profile.id)
      .eq("flashcards.language", profile.target_language),
    supabase.from("user_achievements").select("achievement_id").eq("owner_id", profile.id),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("created_at", isoWeekStart(new Date())),
    // M3 UI slice 2 — Progress redesign: минимальный набор новых запросов
    // (docs/ui/slice2-data-audit.md) для честного insight и "Активность за
    // 7 дней"/skill section — переиспользуем уже существующие helpers из
    // brain-stats.ts (те же, что и Today), а не пишем новую логику лимита.
    getDueCount(supabase, profile.id, profile.target_language),
    getReviewsThisWeekCount(supabase, profile.id, profile.target_language),
    supabase
      .from("reading_sessions")
      .select("started_at")
      .eq("owner_id", profile.id)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("language", profile.target_language)
      .gte("created_at", daysAgo(7).toISOString()),
    // "Завершённые материалы" — тот же честный критерий (percent_read >= 100),
    // что уже используется для ачивки "Первая книга" в achievements-actions.ts.
    supabase
      .from("text_progress")
      .select("text_id, texts!inner(owner_id, language)", { count: "exact", head: true })
      .eq("owner_id", profile.id)
      .eq("texts.language", profile.target_language)
      .gte("percent_read", 100),
    getLanguageTwinEntryState(supabase, profile.id),
    // Missions v1 / Today v2 §5: shared helper (src/lib/missions/persist.ts)
    // so /home and /progress can never quietly report different numbers for
    // the same "completed this week" stat.
    getMissionsCompletedThisWeek(supabase, profile.id, isoWeekStart(new Date())),
  ]);

  const sessions = sessionsQuery.data ?? [];
  const wordsReadTotal = sessions.reduce((s, r) => s + (r.words_looked_up ?? 0), 0);
  const cardsCreated = flashcardsQuery.count ?? 0;
  const reviewLogs = reviewLogQuery.data ?? [];
  const answersGiven = reviewLogs.length;

  const effectiveChartDays =
    period === "all"
      ? computeAllTimeChartDays([
          ...sessions.map((s) => new Date(s.started_at).getTime()),
          ...reviewLogs.map((r) => new Date(r.reviewed_at).getTime()),
        ])
      : chartDays;

  const buckets = buildDayBuckets(effectiveChartDays);
  const wordsPerDay = new Map<string, number>();
  for (const s of sessions) {
    const key = isoDate(s.started_at);
    wordsPerDay.set(key, (wordsPerDay.get(key) ?? 0) + (s.words_looked_up ?? 0));
  }
  const reviewsPerDay = new Map<string, number>();
  for (const r of reviewLogs) {
    const key = isoDate(r.reviewed_at);
    reviewsPerDay.set(key, (reviewsPerDay.get(key) ?? 0) + 1);
  }

  const wordsChartPoints = buckets.map((b) => ({ label: dayLabel(b), value: wordsPerDay.get(b) ?? 0 }));
  const reviewsChartPoints = buckets.map((b) => ({ label: dayLabel(b), value: reviewsPerDay.get(b) ?? 0 }));

  const hardestWords = computeHardestWords(accuracyLogQuery.data ?? [], HARDEST_WORDS_LIMIT);

  // Раздел 5 промта 2026-07-30 (полировка): личные рекорды — витрина
  // гордости вместо просто таблиц. Переиспользуем уже посчитанные
  // wordsPerDay/reviewsPerDay (в рамках выбранного периода) вместо нового
  // запроса; "самая быстрая книга" из черновика не сделана — в схеме нет
  // надёжного способа посчитать её честно, не выдумываем цифру.
  const bestWordsDay = wordsPerDay.size > 0 ? Math.max(...wordsPerDay.values()) : 0;
  const bestReviewsDay = reviewsPerDay.size > 0 ? Math.max(...reviewsPerDay.values()) : 0;

  const activityCounts: Record<string, number> = {};
  for (const s of heatmapSessions.data ?? []) {
    const key = isoDate(s.started_at);
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;
  }
  for (const r of heatmapReviews.data ?? []) {
    const key = isoDate(r.reviewed_at);
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;
  }

  const daysSinceLastReading = lastReadingRow ? daysSince(lastReadingRow.started_at) : null;

  const insight = decideProgressInsight({
    dueReviewsCount,
    totalWordsEver: totalWords ?? 0,
    hasEverRead: lastReadingRow !== null,
    daysSinceLastReading,
    weeklyQuestProgress: weeklyQuestProgress ?? 0,
    weeklyQuestTarget: 20,
    wordsAddedThisWeek: wordsAddedLast7Days ?? 0,
    reviewsThisWeek,
  });

  // Activity section: фиксированное окно "последние 7 дней" (не зависит от
  // PeriodTabs выше) — фильтруем уже полученные sessions/reviewLogs, без
  // дополнительных запросов (см. docs/ui/slice2-data-audit.md).
  const sevenDaysAgo = daysAgo(7);
  const sessionsLast7Days = sessions.filter((s) => new Date(s.started_at) >= sevenDaysAgo);
  const reviewsLast7Days = reviewLogs.filter((r) => new Date(r.reviewed_at) >= sevenDaysAgo);
  const readingDaysLast7 = new Set(sessionsLast7Days.map((s) => isoDate(s.started_at))).size;

  const activeDaysInPeriod = new Set([
    ...sessions.map((s) => isoDate(s.started_at)),
    ...reviewLogs.map((r) => isoDate(r.reviewed_at)),
  ]).size;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <ProgressViewTracker />
      <PageHeader title="Прогресс" description={`Язык: ${profile.target_language}`} />

      <InsightBanner insight={insight} />

      {languageTwinState.kind !== "hidden" && <LanguageTwinSummaryCard state={languageTwinState} variant="progress" />}

      <div>
        <h2 className="text-h3 mb-2">Показатели</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={profile.streak_current} label="Дней подряд сейчас" />
          <StatCard value={activeDaysInPeriod} label="Учебных дней за период" color="blue" />
          <StatCard value={finishedTexts ?? 0} label="Материалов завершено" color="green" />
          <StatCard value={dueReviewsCount} label="К повторению сейчас" color="orange" />
        </div>
      </div>

      <ActivityWeekCard
        data={{
          readingDays: readingDaysLast7,
          sessionsCompleted: sessionsLast7Days.length,
          wordsAdded: wordsAddedLast7Days ?? 0,
          reviewsDone: reviewsLast7Days.length,
        }}
      />

      <div>
        <h2 className="text-h3 mb-2">Направления</h2>
        <SkillSection
          readingSessions={sessions.length}
          vocabularyGrowth={wordsAddedLast7Days ?? 0}
          reviewConsistency={answersGiven}
          activeDays={activeDaysInPeriod}
        />
      </div>

      {missionWeekStats.completed > 0 && (
        <div>
          <h2 className="text-h3 mb-2">Миссии</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={missionWeekStats.completed} label="Миссий завершено за неделю" color="green" />
            <StatCard value={missionWeekStats.skillsTouched} label="Направлений затронуто" color="blue" />
          </div>
        </div>
      )}

      <PeriodTabs current={period} />

      <div>
        <h2 className="mb-2 font-semibold">Словарный запас</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={totalWords ?? 0} label="Слов встречено (всего)" />
          {/* Найдено при повторном аудите: эти карточки — кумулятивное
              состояние словаря, не зависят от вкладки периода выше (в отличие
              от "за период" ниже) — явно помечаем "всего", чтобы не выглядело
              багом на одном экране с показателем, который период учитывает. */}
          <StatCard value={learningWords ?? 0} label="Изучаются всего (ур. 1-3)" color="orange" />
          <StatCard value={knownWords ?? 0} label="Знаю всего (ур. 4)" color="green" />
          <StatCard value={wordsReadTotal} label="Слов прочитано за период" color="purple" />
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Карточки</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={cardsCreated} label="Карточек создано" color="blue" />
          <StatCard value={answersGiven} label="Ответов дано" color="red" />
        </div>
      </div>

      <LineChart title="Слов прочитано в день" points={wordsChartPoints} color="#a67c52" />
      <LineChart title="Карточек повторено в день" points={reviewsChartPoints} color="#2563eb" />

      <HardestWords words={hardestWords} />

      <PersonalRecords
        bestStreak={profile.streak_longest}
        bestWordsDay={bestWordsDay}
        bestSession={profile.review_best_session_count}
        bestReviewsDay={bestReviewsDay}
      />

      <a
        href="/api/share-card"
        download="lexreader-progress.png"
        className="block rounded-2xl bg-card p-4 text-center text-sm font-medium shadow-sm"
      >
        📤 Скачать карточку прогресса
      </a>

      <AchievementsShelf
        earnedIds={new Set((earnedAchievements ?? []).map((a) => a.achievement_id))}
        weeklyQuestProgress={weeklyQuestProgress ?? 0}
        streakFreezeAvailable={profile.streak_freeze_available}
      />

      <div className="overflow-x-auto rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Активность</h2>
        <ActivityHeatmap counts={activityCounts} />
      </div>
    </div>
  );
}
