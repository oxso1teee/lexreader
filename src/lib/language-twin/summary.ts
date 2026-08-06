import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSettings } from "./settings";
import { MIN_EVIDENCE_FOR_PROFILE } from "./constants";
import type { ConfidenceLevel } from "./types";

export interface LanguageTwinSummary {
  focusTitle: string | null;
  strengthTitle: string | null;
  confidence: ConfidenceLevel;
  recommendationReasonKey: string | null;
  lastRecomputedAt: string | null;
}

// Shared by the Today card and the Progress card — both need the same small
// slice of the profile (plan doc §11: "compact summary... does not duplicate
// the full screen"), so the gate and the shape live in one place rather than
// two independent queries drifting apart. Returns null whenever the full
// Overview would also show its empty/disabled state — Today/Progress stay
// silent rather than showing a half-built card.
export async function getLanguageTwinSummary(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<LanguageTwinSummary | null> {
  const settings = await getOrCreateSettings(supabase, userId);
  if (!settings.enabled) return null;

  const { count: evidenceCount } = await supabase
    .from("language_evidence")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  if ((evidenceCount ?? 0) < MIN_EVIDENCE_FOR_PROFILE) return null;

  const { data: twinProfile } = await supabase
    .from("language_twin_profiles")
    .select("confidence, weaknesses_json, strengths_json, last_recomputed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!twinProfile) return null;

  const weaknesses = (twinProfile.weaknesses_json as { title: string }[] | null) ?? [];
  const strengths = (twinProfile.strengths_json as { title: string }[] | null) ?? [];

  const { data: rec } = await supabase
    .from("language_recommendations")
    .select("reason_key")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("priority", { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    focusTitle: weaknesses[0]?.title ?? null,
    strengthTitle: strengths[0]?.title ?? null,
    confidence: twinProfile.confidence,
    recommendationReasonKey: rec?.reason_key ?? null,
    lastRecomputedAt: twinProfile.last_recomputed_at,
  };
}
