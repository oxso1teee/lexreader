import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import ActivityHeatmap from "./activity-heatmap";
import PeriodTabs from "./period-tabs";
import StatCard from "./stat-card";
import LineChart from "./line-chart";

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
    (() => {
      let q = supabase
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", profile.id);
      if (cutoff) q = q.gte("created_at", cutoff.toISOString());
      return q;
    })(),
    (() => {
      let q = supabase
        .from("review_log")
        .select("reviewed_at, flashcards!inner(owner_id)")
        .eq("flashcards.owner_id", profile.id);
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
      .select("reviewed_at, flashcards!inner(owner_id)")
      .eq("flashcards.owner_id", profile.id)
      .gte("reviewed_at", heatmapCutoff.toISOString()),
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

  const activityCounts: Record<string, number> = {};
  for (const s of heatmapSessions.data ?? []) {
    const key = isoDate(s.started_at);
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;
  }
  for (const r of heatmapReviews.data ?? []) {
    const key = isoDate(r.reviewed_at);
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">📊 Статистика</h1>
        <span className="rounded-lg border border-black/20 px-2.5 py-1 text-sm font-medium dark:border-white/25">
          {profile.target_language}
        </span>
      </div>

      <PeriodTabs current={period} />

      <div>
        <h2 className="mb-2 font-semibold">Словарный запас</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={totalWords ?? 0} label="Слов встречено (всего)" />
          <StatCard value={learningWords ?? 0} label="Изучаются (ур. 1-3)" color="orange" />
          <StatCard value={knownWords ?? 0} label="Знаю (ур. 4)" color="green" />
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

      <div className="overflow-x-auto rounded-2xl bg-card p-4 shadow-sm">
        <h2 className="mb-2 font-semibold">Активность</h2>
        <ActivityHeatmap counts={activityCounts} />
      </div>
    </div>
  );
}
