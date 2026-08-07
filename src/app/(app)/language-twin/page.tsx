import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateSettingsSafe } from "@/lib/language-twin/settings";
import { recomputeLanguageTwin, isProfileStale } from "@/lib/language-twin/recompute";
import { MIN_EVIDENCE_FOR_PROFILE } from "@/lib/language-twin/constants";
import EmptyState from "@/components/empty-state";
import PageHeader from "@/components/product/page-header";
import SectionHeader from "@/components/product/section-header";
import { ConfidenceBadge, StatusBadge, TrendIndicator, CategoryBadge } from "@/components/product/language-twin/badges";
import LanguageTwinUnavailable from "@/components/product/language-twin/unavailable";
import type { PatternRow } from "@/lib/language-twin/types";
import RecomputeButton from "./recompute-button";
import HowCalculated from "./how-calculated";
import LanguageTwinSections from "./sections";
import RecommendationCard, { type RecommendationCardData } from "./recommendation-card";
import EnableToggleInline from "./enable-toggle-inline";
import StrengthsList from "./strengths-list";
import LanguageTwinAnalytics from "./language-twin-analytics";

const OVERVIEW_SUBTITLE =
  "LexReader анализирует твоё чтение, практику и упражнения, чтобы показать, что уже получается и что стоит улучшить.";

export default async function LanguageTwinPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getOrCreateSettingsSafe(supabase, profile.id);

  if (!settings) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
        <PageHeader title="Мой английский" />
        <LanguageTwinUnavailable />
      </div>
    );
  }

  if (!settings.enabled) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
        <LanguageTwinAnalytics confidence="none" />
        <PageHeader title="Мой английский" description="Language Twin сейчас выключен" />
        <EmptyState
          icon="🌙"
          title="Language Twin выключен"
          body="Мы не собираем новых данных и не строим выводов, пока функция выключена. Включить можно в любой момент — уже накопленные данные никуда не денутся."
          action={<EnableToggleInline />}
        />
      </div>
    );
  }

  let { data: twinProfile } = await supabase
    .from("language_twin_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (!twinProfile || isProfileStale(twinProfile.last_recomputed_at)) {
    await recomputeLanguageTwin(supabase, profile.id, profile.target_language);
    const refetch = await supabase
      .from("language_twin_profiles")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();
    twinProfile = refetch.data;
  }

  const { count: evidenceCount } = await supabase
    .from("language_evidence")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .is("deleted_at", null);

  if (!twinProfile || (evidenceCount ?? 0) < MIN_EVIDENCE_FOR_PROFILE) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
        <LanguageTwinAnalytics confidence="none" />
        <PageHeader title="Мой английский" description={OVERVIEW_SUBTITLE} />
        <EmptyState
          icon="🌱"
          title="Пока недостаточно данных"
          body="Language Twin учится на твоей реальной активности — почитай что-нибудь, повтори карточки в Мозге или пройди короткую диагностику, и здесь появятся первые выводы."
          action={
            <Link
              href="/language-twin/diagnostic"
              className="focus-ring mt-2 rounded-full bg-caramel px-4 py-2 text-sm font-medium text-black"
            >
              Пройти мини-диагностику
            </Link>
          }
        />
        <SectionHeader title="Разделы" />
        <LanguageTwinSections />
      </div>
    );
  }

  const { data: patternsData } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", profile.id)
    .in("status", ["active", "improving", "uncertain"]);
  const patterns = (patternsData ?? []) as PatternRow[];
  const topPattern = [...patterns].sort((a, b) => {
    const weight = { high: 3, medium: 2, low: 1 } as const;
    return weight[b.severity] - weight[a.severity];
  })[0];

  const { data: recsData } = await supabase
    .from("language_recommendations")
    .select("*")
    .eq("user_id", profile.id)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .limit(1);
  const topRecommendation = (recsData ?? [])[0] as RecommendationCardData | undefined;

  const strengths = (twinProfile.strengths_json as { title: string; evidence: string }[]) ?? [];

  const isLowConfidence = twinProfile.confidence === "low" && patterns.length === 0 && strengths.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4">
      <LanguageTwinAnalytics confidence={isLowConfidence ? "low" : twinProfile.confidence} />
      <PageHeader title="Мой английский" description={OVERVIEW_SUBTITLE} action={<RecomputeButton />} />

      {isLowConfidence ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-[var(--color-warning)]/10 p-4">
          <p className="text-sm">
            Данных пока мало и они немного противоречат друг другу — общий диапазон уровня показать честно
            не можем.
          </p>
          <Link
            href="/language-twin/diagnostic"
            className="focus-ring self-start rounded-full border border-[var(--border-strong)] px-4 py-2 text-sm font-medium"
          >
            Пройти мини-диагностику
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xl font-bold">{twinProfile.behavioral_level_range ?? "Собираем оценку"}</span>
                <ConfidenceBadge level={twinProfile.confidence} />
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                Обновлено{" "}
                {twinProfile.last_recomputed_at
                  ? new Date(twinProfile.last_recomputed_at).toLocaleDateString("ru-RU")
                  : "—"}{" "}
                · {evidenceCount} записей ·{" "}
                <HowCalculated
                  selfReportedLevel={profile.level}
                  diagnosticLevelRange={twinProfile.diagnostic_level_range}
                  behavioralLevelRange={twinProfile.behavioral_level_range}
                />
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Пассивный словарь</p>
              <p className="text-lg font-bold">{twinProfile.observed_receptive_vocabulary ?? 0}+ слов</p>
              <p className="text-xs text-[var(--text-secondary)]">наблюдаемый минимум, не оценка</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="text-xs text-[var(--text-secondary)]">Активный словарь</p>
              <p className="text-lg font-bold">{twinProfile.observed_active_vocabulary ?? 0}+ слов</p>
              <p className="text-xs text-[var(--text-secondary)]">то, что реально вспоминаешь</p>
            </div>
          </div>
        </div>
      )}

      {topPattern && (
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Сейчас в фокусе</h2>
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={topPattern.category} />
              <StatusBadge status={topPattern.status} />
              <TrendIndicator trend={topPattern.trend} />
            </div>
            <p className="text-sm font-medium">{topPattern.title}</p>
            <Link
              href="/language-twin/patterns"
              className="focus-ring self-start text-sm font-medium text-[var(--color-caramel-text)] underline-offset-2 hover:underline"
            >
              Открыть паттерн →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold">Сильные стороны</h2>
          <div className="flex flex-col gap-1">
            <StrengthsList strengths={strengths} />
          </div>
        </div>
        <div className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Над чем работаем</h2>
            <Link href="/language-twin/patterns" className="text-sm text-[var(--color-caramel-text)]">
              Все →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {patterns.length === 0 ? (
              <p className="text-sm text-[var(--text-secondary)]">Активных паттернов нет.</p>
            ) : (
              patterns.slice(0, 2).map((p) => (
                <div key={p.id} className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning)]" />
                  <p className="text-sm">{p.title}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Рекомендация на сегодня</h2>
          <Link href="/language-twin/recommendations" className="text-sm text-[var(--color-caramel-text)]">
            Все →
          </Link>
        </div>
        {topRecommendation ? (
          <RecommendationCard rec={topRecommendation} />
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">Рекомендаций пока нет.</p>
        )}
      </div>

      <SectionHeader title="Разделы" />
      <LanguageTwinSections />
    </div>
  );
}
