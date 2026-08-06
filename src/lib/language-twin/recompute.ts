import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getActivationCandidates, detectActivationGaps } from "./activation-gap";
import { getRecallGaps } from "./review-recall";
import { computeConfidence, type ConfidenceSignal } from "./confidence";
import { buildRecommendations } from "./recommendations";
import { behavioralLevelRange } from "./behavioral-level";
import { getOrCreateSettings } from "./settings";
import type { PatternDraft, PatternRow } from "./types";

const ALGORITHM_VERSION = 1;
// A profile recomputed more recently than this is considered fresh — the
// Overview screen's "recompute" button and the on-view auto-refresh both
// check this before doing any work (plan doc §27: throttled, not per-event).
export const STALE_AFTER_MS = 60 * 60 * 1000;

function patternSignals(gaps: { lastReviewedAt?: string; accuracy: number }[]): ConfidenceSignal[] {
  return gaps.flatMap((g) => [
    { occurredAt: g.lastReviewedAt ?? new Date().toISOString(), sourceType: "review", outcome: "failure" as const },
    { occurredAt: g.lastReviewedAt ?? new Date().toISOString(), sourceType: "reading", outcome: "failure" as const },
  ]);
}

async function upsertPattern(
  supabase: SupabaseServerClient,
  userId: string,
  draft: PatternDraft,
): Promise<PatternRow> {
  const { data: existing } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", userId)
    .eq("pattern_key", draft.patternKey)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    const nextStatus = existing.status === "dismissed" ? "dismissed" : "active";
    const trend: PatternDraft["trend"] =
      draft.evidenceCount > existing.evidence_count
        ? "up"
        : draft.evidenceCount < existing.evidence_count
          ? "down"
          : "flat";
    const { data } = await supabase
      .from("language_error_patterns")
      .update({
        title: draft.title,
        description: draft.description,
        confidence: draft.confidence,
        confidence_score: draft.confidenceScore,
        evidence_count: draft.evidenceCount,
        severity: draft.severity,
        trend,
        status: nextStatus,
        last_seen_at: now,
        metadata_json: draft.metadata ?? {},
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    return data ?? existing;
  }

  const { data } = await supabase
    .from("language_error_patterns")
    .insert({
      user_id: userId,
      category: draft.category,
      pattern_key: draft.patternKey,
      title: draft.title,
      description: draft.description,
      confidence: draft.confidence,
      confidence_score: draft.confidenceScore,
      evidence_count: draft.evidenceCount,
      severity: draft.severity,
      trend: draft.trend,
      status: "active",
      first_seen_at: now,
      last_seen_at: now,
      metadata_json: draft.metadata ?? {},
    })
    .select("*")
    .single();
  return data!;
}

// A previously-active pattern that isn't redetected this run genuinely
// improved (or the underlying words/cards changed) — mark it "improving"
// rather than silently leaving a stale "active" status forever. Dismissed
// patterns are never touched here (that's a user decision, not the engine's).
async function resolveStalePatterns(
  supabase: SupabaseServerClient,
  userId: string,
  redetectedKeys: string[],
): Promise<void> {
  let query = supabase
    .from("language_error_patterns")
    .update({ status: "improving", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active");
  if (redetectedKeys.length > 0) {
    query = query.not("pattern_key", "in", `(${redetectedKeys.map((k) => `"${k}"`).join(",")})`);
  }
  await query;
}

export async function recomputeLanguageTwin(
  supabase: SupabaseServerClient,
  userId: string,
  language: string,
): Promise<void> {
  const settings = await getOrCreateSettings(supabase, userId);
  if (!settings.enabled) return;

  const patternDrafts: PatternDraft[] = [];
  const coveredFlashcardIds = new Set<string>();

  if (settings.include_saved_vocabulary && settings.include_review_history) {
    const candidates = await getActivationCandidates(supabase, userId, language);
    const gaps = detectActivationGaps(candidates);
    gaps.forEach((g) => coveredFlashcardIds.add(g.flashcardId));
    if (gaps.length > 0) {
      const confidence = computeConfidence(patternSignals(gaps));
      patternDrafts.push({
        patternKey: "activation_gap",
        category: "activation",
        title: "Слово узнаёшь, но не вспоминаешь на карточке",
        description: `${gaps.length} слов ты хорошо знаешь по чтению, но регулярно не вспоминаешь на повторении в Мозге.`,
        severity: gaps.length >= 8 ? "high" : gaps.length >= 3 ? "medium" : "low",
        evidenceCount: gaps.reduce((s, g) => s + g.totalAttempts, 0),
        confidenceScore: confidence.score,
        confidence: confidence.level,
        trend: "flat",
        metadata: {
          words: gaps.slice(0, 20).map((g) => ({
            headword: g.headword,
            translation: g.translation,
            accuracy: g.accuracy,
            flashcardId: g.flashcardId,
          })),
        },
      });
    }
  }

  if (settings.include_review_history) {
    const recallGaps = await getRecallGaps(supabase, userId, language, coveredFlashcardIds);
    if (recallGaps.length > 0) {
      const confidence = computeConfidence(
        recallGaps.map(() => ({ occurredAt: new Date().toISOString(), sourceType: "review", outcome: "failure" as const })),
      );
      patternDrafts.push({
        patternKey: "review_recall",
        category: "review_recall",
        title: "Повторяющиеся ошибки на повторении",
        description: `${recallGaps.length} карточек с точностью ниже 50% за последние повторения.`,
        severity: recallGaps.length >= 10 ? "high" : recallGaps.length >= 4 ? "medium" : "low",
        evidenceCount: recallGaps.reduce((s, g) => s + g.total, 0),
        confidenceScore: confidence.score,
        confidence: confidence.level,
        trend: "flat",
        metadata: {
          words: recallGaps.slice(0, 20).map((g) => ({
            headword: g.front,
            translation: g.back,
            accuracy: g.accuracy,
            flashcardId: g.id,
          })),
        },
      });
    }
  }

  for (const draft of patternDrafts) {
    await upsertPattern(supabase, userId, draft);
  }
  await resolveStalePatterns(supabase, userId, patternDrafts.map((d) => d.patternKey));

  const { data: activePatterns } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "improving", "uncertain"]);
  const patterns = activePatterns ?? [];

  const { count: observedReceptiveVocabulary } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("language", language);

  const { count: observedActiveVocabulary } = await supabase
    .from("vocabulary_items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("language", language)
    .gte("level", 3)
    .not("flashcard_id", "is", null);

  const allGradesForAccuracy = patterns.flatMap((p) =>
    ((p.metadata_json as { words?: { accuracy: number }[] }).words ?? []).map((w) => w.accuracy),
  );
  const avgAccuracy =
    allGradesForAccuracy.length > 0
      ? allGradesForAccuracy.reduce((a, b) => a + b, 0) / allGradesForAccuracy.length
      : null;

  const overallSignals: ConfidenceSignal[] = [
    ...(observedReceptiveVocabulary
      ? [{ occurredAt: new Date().toISOString(), sourceType: "reading", outcome: "neutral" as const }]
      : []),
    ...patterns.map((p) => ({ occurredAt: p.last_seen_at, sourceType: "review", outcome: "neutral" as const })),
  ];
  const overallConfidence = computeConfidence(overallSignals);

  const strengths: { title: string; evidence: string }[] = [];
  if (patterns.length === 0 && (observedReceptiveVocabulary ?? 0) >= 15) {
    strengths.push({
      title: "Стабильный recall без явных слабых паттернов",
      evidence: "Ни одна карточка не показывает регулярных ошибок при последнем пересчёте.",
    });
  }
  if ((observedActiveVocabulary ?? 0) >= 20) {
    strengths.push({
      title: "Растущий активный словарь",
      evidence: `${observedActiveVocabulary} слов уверенно вспоминаются на повторении.`,
    });
  }

  const recDrafts = buildRecommendations(patterns, patterns.length > 0 || (observedReceptiveVocabulary ?? 0) >= 15);

  await supabase.from("language_recommendations").delete().eq("user_id", userId).eq("status", "pending");
  for (const draft of recDrafts) {
    const relatedPattern = patterns.find((p) => p.pattern_key === draft.relatedPatternKey);
    await supabase.from("language_recommendations").insert({
      user_id: userId,
      recommendation_type: draft.recommendationType,
      priority: draft.priority,
      reason_key: draft.reasonKey,
      related_pattern_id: relatedPattern?.id ?? null,
      action_type: draft.actionType,
      action_target_json: draft.actionTarget,
      status: "pending",
    });
  }

  const behavioralLevel = behavioralLevelRange(observedReceptiveVocabulary ?? 0, avgAccuracy);

  const { data: profileRow } = await supabase
    .from("language_twin_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  const profilePayload = {
    behavioral_level_range: behavioralLevel,
    confidence: overallConfidence.level,
    confidence_score: overallConfidence.score,
    observed_receptive_vocabulary: observedReceptiveVocabulary ?? 0,
    observed_active_vocabulary: observedActiveVocabulary ?? 0,
    strengths_json: strengths,
    weaknesses_json: patterns.map((p) => ({ patternKey: p.pattern_key, title: p.title, category: p.category })),
    recommendations_json: recDrafts,
    algorithm_version: ALGORITHM_VERSION,
    last_recomputed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (profileRow) {
    await supabase.from("language_twin_profiles").update(profilePayload).eq("user_id", userId);
  } else {
    await supabase.from("language_twin_profiles").insert({ user_id: userId, ...profilePayload });
  }
}

export function isProfileStale(lastRecomputedAt: string | null): boolean {
  if (!lastRecomputedAt) return true;
  return Date.now() - new Date(lastRecomputedAt).getTime() > STALE_AFTER_MS;
}
