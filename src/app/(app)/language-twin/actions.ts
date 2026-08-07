"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { recomputeLanguageTwin, isProfileStale } from "@/lib/language-twin/recompute";
import { getOrCreateSettings, getOrCreateSettingsSafe, updateSettings } from "@/lib/language-twin/settings";
import { deleteEvidence, recordEvidence } from "@/lib/language-twin/evidence";
import { checkSentence } from "@/lib/language-twin/correction-rules";
import { scoreDiagnostic, diagnosticLevelRange, DIAGNOSTIC_VERSION } from "@/lib/language-twin/diagnostic";
import type { LanguageTwinSettings } from "@/lib/language-twin/types";

const PATH = "/language-twin";

export async function getProfileAndSettings() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getOrCreateSettings(supabase, profile.id);
  const { data: twinProfile } = await supabase
    .from("language_twin_profiles")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  return { profile, settings, twinProfile };
}

export async function recomputeAction(): Promise<{ ok: boolean; error?: string }> {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Manual recompute is exempt from the staleness gate (an explicit user
  // click should always do something), but the auto-refresh-on-view path
  // (recomputeIfStale below) respects it — this keeps the button honest
  // without letting page views alone trigger unbounded recompute work.
  try {
    await recomputeLanguageTwin(supabase, profile.id, profile.target_language);
  } catch {
    return { ok: false, error: "Не удалось пересчитать профиль. Попробуй ещё раз." };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function recomputeIfStaleAction(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: twinProfile } = await supabase
    .from("language_twin_profiles")
    .select("last_recomputed_at")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!twinProfile || isProfileStale(twinProfile.last_recomputed_at)) {
    await recomputeLanguageTwin(supabase, profile.id, profile.target_language);
    revalidatePath(PATH);
  }
}

export async function dismissPatternAction(patternId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("language_error_patterns")
    .update({ status: "dismissed", updated_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("id", patternId);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/patterns`);
}

export async function restorePatternAction(patternId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("language_error_patterns")
    .update({ status: "uncertain", updated_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("id", patternId);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/patterns`);
}

export async function markPatternInaccurateAction(patternId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("language_error_patterns")
    .select("metadata_json")
    .eq("user_id", profile.id)
    .eq("id", patternId)
    .maybeSingle();
  const metadata = (existing?.metadata_json as Record<string, unknown>) ?? {};
  const nextInaccurate = !metadata.markedInaccurate;
  await supabase
    .from("language_error_patterns")
    .update({
      metadata_json: { ...metadata, markedInaccurate: nextInaccurate },
      status: nextInaccurate ? "uncertain" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", profile.id)
    .eq("id", patternId);
  revalidatePath(`${PATH}/patterns`);
}

export async function deleteEvidenceAction(evidenceId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await deleteEvidence(supabase, profile.id, evidenceId);
  revalidatePath(`${PATH}/evidence`);
  revalidatePath(`${PATH}/patterns`);
}

export async function dismissRecommendationAction(recommendationId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("language_recommendations")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("id", recommendationId);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/recommendations`);
}

export async function completeRecommendationAction(recommendationId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("language_recommendations")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("user_id", profile.id)
    .eq("id", recommendationId);
  revalidatePath(PATH);
  revalidatePath(`${PATH}/recommendations`);
}

export async function updateSettingsAction(
  patch: Partial<Omit<LanguageTwinSettings, "user_id" | "algorithm_version">>,
): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await updateSettings(supabase, profile.id, patch);
  revalidatePath(`${PATH}/settings`);
  revalidatePath(PATH);
}

export async function resetLanguageTwinAction(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Deliberately only these six tables — never touches vocabulary_items,
  // flashcards, review_log, srs_state, or reading_sessions (plan doc §25).
  await Promise.all([
    supabase.from("language_recommendations").delete().eq("user_id", profile.id),
    supabase.from("language_evidence").delete().eq("user_id", profile.id),
    supabase.from("language_error_patterns").delete().eq("user_id", profile.id),
    supabase.from("language_correction_submissions").delete().eq("user_id", profile.id),
    supabase.from("language_twin_profiles").delete().eq("user_id", profile.id),
  ]);
  revalidatePath(PATH);
}

export interface CorrectionCheckResult {
  supported: boolean;
  matches: {
    patternKey: string;
    category: string;
    confidence: string;
    explanation: string;
    suggestion: string;
  }[];
}

// Read-only check — does NOT store the sentence. Storage only happens in
// saveCorrectionEvidenceAction below, after the user explicitly opts in
// (plan doc §13: never auto-save free text).
export async function checkCorrectionAction(text: string): Promise<CorrectionCheckResult> {
  await requireProfile();
  return checkSentence(text);
}

export interface SaveCorrectionEvidenceResult {
  ok: boolean;
  patternTitle?: string;
}

export async function saveCorrectionEvidenceAction(
  text: string,
  result: CorrectionCheckResult,
): Promise<SaveCorrectionEvidenceResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: submission, error } = await supabase
    .from("language_correction_submissions")
    .insert({
      user_id: profile.id,
      submitted_text: text,
      detected_patterns_json: result.matches,
      suggested_correction: result.matches[0]?.suggestion ?? null,
    })
    .select("id")
    .single();
  if (error || !submission) return { ok: false };

  for (const match of result.matches) {
    await recordEvidence(supabase, {
      userId: profile.id,
      evidenceType: "correction_match",
      sourceType: "correction_submission",
      sourceId: submission.id,
      normalizedCategory: match.category,
      result: "observed",
      confidence: match.confidence as "low" | "medium" | "high",
      metadata: { patternKey: match.patternKey },
    });
  }

  // An explicit save is a meaningful signal worth reflecting immediately —
  // exempt from the staleness gate for the same reason the manual
  // "Recompute" button is (recomputeAction above): a passive view-triggered
  // refresh could sit up to an hour stale and make "check → save" feel
  // disconnected from the profile it's supposed to update.
  await recomputeLanguageTwin(supabase, profile.id, profile.target_language);

  revalidatePath(`${PATH}/evidence`);
  revalidatePath(`${PATH}/patterns`);
  revalidatePath(`${PATH}/recommendations`);
  revalidatePath(PATH);

  const categories = [...new Set(result.matches.map((m) => m.category))];
  let patternTitle: string | undefined;
  if (categories.length > 0) {
    const { data: pattern } = await supabase
      .from("language_error_patterns")
      .select("title")
      .eq("user_id", profile.id)
      .in("category", categories)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    patternTitle = pattern?.title ?? undefined;
  }

  return { ok: true, patternTitle };
}

export interface DiagnosticSignal {
  label: string;
  detail: string;
}

export interface DiagnosticSubmitResult {
  correct: number;
  total: number;
  levelRange: string | null;
  signals: DiagnosticSignal[];
}

const DIAGNOSTIC_TAG_LABEL: Record<string, string> = {
  tense: "Времена",
  article: "Артикли",
  passive: "Passive",
  gerund_infinitive: "Gerund/Infinitive",
  preposition: "Предлоги",
  word_order: "Порядок слов",
};

const BEHAVIORAL_SIGNAL_LABEL: Record<string, string> = {
  review_recall: "Vocabulary recall",
  activation: "Passive recognition",
};

const CONFIDENCE_PHRASE: Record<string, string> = {
  low: "низкая уверенность",
  medium: "средняя уверенность",
  high: "высокая уверенность",
};

export async function submitDiagnosticAction(answers: (number | null)[]): Promise<DiagnosticSubmitResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getOrCreateSettingsSafe(supabase, profile.id);
  const score = scoreDiagnostic(answers);
  const levelRange = diagnosticLevelRange(score);

  // Scoring itself is pure/local — the diagnostic result is still shown to
  // the user even if Language Twin's storage is unavailable; only the
  // evidence-recording side effect below is skipped in that case.
  if (settings?.allow_diagnostic) {
    const { data: session } = await supabase
      .from("language_evidence")
      .insert({
        user_id: profile.id,
        evidence_type: "diagnostic_result",
        source_type: "diagnostic_session",
        result: `${score.correct}/${score.total}`,
        confidence: score.total >= 5 ? "medium" : "low",
        metadata_json: { byTag: score.byTag, version: DIAGNOSTIC_VERSION },
      })
      .select("id")
      .single();
    void session;

    await supabase
      .from("language_twin_profiles")
      .upsert(
        { user_id: profile.id, diagnostic_level_range: levelRange, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
  }

  // Result-screen signals (plan doc: "Профиль обновлён" screen) mix this
  // diagnostic's own per-tag answers with the two existing behavioral
  // patterns — both are real, already-computed data, not fabricated
  // confidence language. Skipped entirely if the schema is unreachable
  // (settings null), same guard as the evidence-recording branch above.
  const diagnosticSignals: DiagnosticSignal[] = Object.entries(score.byTag).map(([tag, tagScore]) => ({
    label: DIAGNOSTIC_TAG_LABEL[tag] ?? tag,
    detail: tagScore.correct === tagScore.total ? "есть сигнал" : "пока не уверены",
  }));

  let behavioralPatterns: { category: string; confidence: string }[] = [];
  if (settings) {
    const { data } = await supabase
      .from("language_error_patterns")
      .select("category, confidence")
      .eq("user_id", profile.id)
      .in("category", ["review_recall", "activation"])
      .in("status", ["active", "improving", "uncertain"]);
    behavioralPatterns = data ?? [];
  }
  const behavioralSignals: DiagnosticSignal[] = (["review_recall", "activation"] as const).map((category) => {
    const row = behavioralPatterns.find((p) => p.category === category);
    return {
      label: BEHAVIORAL_SIGNAL_LABEL[category],
      detail: row ? CONFIDENCE_PHRASE[row.confidence] ?? row.confidence : "пока мало данных",
    };
  });

  revalidatePath(PATH);
  return {
    correct: score.correct,
    total: score.total,
    levelRange,
    signals: [...diagnosticSignals, ...behavioralSignals],
  };
}
