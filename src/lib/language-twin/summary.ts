import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getOrCreateSettingsSafe } from "./settings";
import { pickTopPattern } from "./recompute";
import { MIN_EVIDENCE_FOR_PROFILE } from "./constants";
import type { ConfidenceLevel, PatternRow } from "./types";

export interface LanguageTwinSummary {
  focusTitle: string | null;
  // The concrete, real stat behind focusTitle (e.g. "12 слов ты хорошо
  // знаешь по чтению, но регулярно не вспоминаешь..." — recompute.ts
  // already writes this onto the pattern row; twinProfile.weaknesses_json
  // only ever carried the bare title, which is why Today's card used to say
  // *what* the focus is but never *why* — see the "Твой фокус сегодня" fix.
  focusDescription: string | null;
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
    .select("confidence, strengths_json, last_recomputed_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!twinProfile) return { kind: "invite" };

  const { data: patternsData } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "improving", "uncertain"]);
  const topPattern = pickTopPattern((patternsData ?? []) as PatternRow[]);

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
      focusTitle: topPattern?.title ?? null,
      focusDescription: topPattern?.description ?? null,
      strengthTitle: strengths[0]?.title ?? null,
      confidence: twinProfile.confidence,
      recommendationReasonKey: rec?.reason_key ?? null,
      lastRecomputedAt: twinProfile.last_recomputed_at,
    },
  };
}
