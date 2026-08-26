import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { EvidenceInput, EvidenceRow, EvidenceSourceType, LanguageTwinSettings } from "./types";
import { getOrCreateSettingsSafe } from "./settings";

// Which per-source opt-out gates each evidence source_type. vocabulary_item
// evidence is literally "saved vocabulary" (word/level/seen_count from
// vocabulary_items), so it's gated by include_saved_vocabulary specifically
// — include_reading_behavior is reserved for broader reading_sessions-based
// signals not yet used by any v1 evidence type, kept as a real toggle for
// forward compatibility rather than removed.
const SOURCE_TYPE_SETTING: Record<EvidenceSourceType, keyof LanguageTwinSettings> = {
  flashcard: "include_review_history",
  vocabulary_item: "include_saved_vocabulary",
  correction_submission: "include_writing_exercises",
  diagnostic_session: "allow_diagnostic",
  // M3 Slice 9 — Placement v2 is the diagnostic's front-door sibling, so it
  // shares the same opt-out toggle rather than introducing a new one.
  placement_session: "allow_diagnostic",
};

// Returns null (silently, not an error) when the feature or the relevant
// source is disabled — call sites should treat "no evidence recorded" as a
// normal, expected outcome of an opt-out, not a failure (plan doc §9: the
// toggle must be real, not decorative).
//
// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// found while wiring up the extension's save path: this used the throwing
// getOrCreateSettings, so a Language Twin storage hiccup (e.g. a missing
// service_role grant — exactly the api/extension/translate-and-save case,
// the first ever service_role caller of saveVocabularyItem) took the
// entire word save down with it, contradicting this function's own
// documented contract above ("returns null, not an error"/never blocks an
// unrelated save) and getOrCreateSettingsSafe's own stated purpose ("never
// let a Language Twin storage problem take down surrounding content that
// has nothing to do with this feature").
export async function recordEvidence(
  supabase: SupabaseServerClient,
  input: EvidenceInput,
): Promise<EvidenceRow | null> {
  const settings = await getOrCreateSettingsSafe(supabase, input.userId);
  if (!settings || !settings.enabled) return null;
  if (!settings[SOURCE_TYPE_SETTING[input.sourceType]]) return null;

  const { data, error } = await supabase
    .from("language_evidence")
    .insert({
      user_id: input.userId,
      pattern_id: input.patternId ?? null,
      evidence_type: input.evidenceType,
      source_type: input.sourceType,
      source_id: input.sourceId ?? null,
      normalized_category: input.normalizedCategory ?? null,
      result: input.result ?? null,
      confidence: input.confidence,
      metadata_json: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function listEvidence(
  supabase: SupabaseServerClient,
  userId: string,
  filters?: { sourceType?: EvidenceSourceType; patternId?: string },
): Promise<EvidenceRow[]> {
  let query = supabase
    .from("language_evidence")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false });
  if (filters?.sourceType) query = query.eq("source_type", filters.sourceType);
  if (filters?.patternId) query = query.eq("pattern_id", filters.patternId);
  const { data } = await query;
  return data ?? [];
}

// Soft delete only — never touches flashcards/review_log/vocabulary_items,
// and never removes the row outright so a future recompute can still see
// "evidence N was here, then deleted" if that's ever needed for auditing.
export async function deleteEvidence(
  supabase: SupabaseServerClient,
  userId: string,
  evidenceId: string,
): Promise<void> {
  const { error } = await supabase
    .from("language_evidence")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", evidenceId);
  if (error) throw new Error("Не удалось удалить свидетельство.");
}
