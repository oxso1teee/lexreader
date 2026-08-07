import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSettingsSafe } from "./settings";
import { MIN_EVIDENCE_FOR_PROFILE } from "./constants";
import type { ConfidenceLevel } from "./types";

export interface LanguageTwinSummary {
  focusTitle: string | null;
  strengthTitle: string | null;
  confidence: ConfidenceLevel;
  recommendationReasonKey: string | null;
  lastRecomputedAt: string | null;
}

// Incident 2026-08-06: the old boolean gate (evidence >= 15 or nothing) meant
// a real account — which starts at zero evidence — had literally no way to
// discover Language Twin from Today/Progress, ever, until it had already
// accumulated 15 rows on its own. That's not "hidden while empty", that's
// undiscoverable. "hidden" is now reserved for the two cases where showing
// *anything* would be actively wrong: the feature's own storage isn't
// reachable (getOrCreateSettingsSafe returned null), or the user explicitly
// turned it off in Settings (already surfaced there, not repeated here).
// Every other state gets a real, always-visible entry point.
export type LanguageTwinEntryState =
  | { kind: "hidden" }
  | { kind: "invite" }
  | { kind: "ready"; summary: LanguageTwinSummary };

export async function getLanguageTwinEntryState(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<LanguageTwinEntryState> {
  const settings = await getOrCreateSettingsSafe(supabase, userId);
  if (!settings || !settings.enabled) return { kind: "hidden" };

  const { count: evidenceCount } = await supabase
    .from("language_evidence")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);
  if ((evidenceCount ?? 0) < MIN_EVIDENCE_FOR_PROFILE) return { kind: "invite" };

  const { data: twinProfile } = await supabase
    .from("language_twin_profiles")
    .select("confidence, weaknesses_json, strengths_json, last_recomputed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!twinProfile) return { kind: "invite" };

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
    kind: "ready",
    summary: {
      focusTitle: weaknesses[0]?.title ?? null,
      strengthTitle: strengths[0]?.title ?? null,
      confidence: twinProfile.confidence,
      recommendationReasonKey: rec?.reason_key ?? null,
      lastRecomputedAt: twinProfile.last_recomputed_at,
    },
  };
}
