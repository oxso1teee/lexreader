"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getOrGenerateActiveMissions } from "@/lib/missions/persist";
import { recordEvidence } from "@/lib/language-twin/evidence";
import { recomputeLanguageTwin } from "@/lib/language-twin/recompute";
import type { EvidenceSourceType } from "@/lib/language-twin/types";
import type { MissionAttemptRow, MissionRow, MissionType } from "@/lib/missions/types";

const PATH = "/missions";

export async function getActiveMissionsAction(): Promise<MissionRow[]> {
  const profile = await requireProfile();
  const supabase = await createClient();
  return getOrGenerateActiveMissions(supabase, profile.id);
}

// Ownership check for every mission-scoped action below: RLS already makes
// a cross-user row invisible, but re-checking `user_id = profile.id`
// explicitly (rather than relying on RLS alone) means a malicious/garbled
// missionId reliably returns null instead of depending on RLS being the
// only line of defense (plan doc §41).
async function fetchOwnedMission(supabase: Awaited<ReturnType<typeof createClient>>, missionId: string, userId: string): Promise<MissionRow | null> {
  const { data } = await supabase.from("missions").select("*").eq("id", missionId).eq("user_id", userId).maybeSingle();
  return (data as MissionRow | null) ?? null;
}

export async function getMissionAction(missionId: string): Promise<MissionRow | null> {
  const profile = await requireProfile();
  const supabase = await createClient();
  return fetchOwnedMission(supabase, missionId, profile.id);
}

// Most recent attempt regardless of open/completed — the Mission screen uses
// this to render the Player (open attempt) or Result (completed attempt)
// state after a reload, not just right after the action that created it.
export async function getMissionAttemptAction(missionId: string): Promise<MissionAttemptRow | null> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const mission = await fetchOwnedMission(supabase, missionId, profile.id);
  if (!mission) return null;
  const { data } = await supabase
    .from("mission_attempts")
    .select("*")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as MissionAttemptRow | null) ?? null;
}

export interface StartMissionResult {
  mission: MissionRow;
  attempt: MissionAttemptRow;
}

export async function startMissionAction(missionId: string): Promise<StartMissionResult | null> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const mission = await fetchOwnedMission(supabase, missionId, profile.id);
  if (!mission) return null;
  if (mission.status !== "available" && mission.status !== "started") return null;

  // mission_attempts_active_idx guarantees at most one open attempt per
  // mission — a duplicate start request either finds the existing one or
  // loses a genuine insert race and re-fetches the winner's row (plan doc
  // §42's "duplicate start" case).
  let attempt = await fetchOpenAttempt(supabase, missionId);
  if (!attempt) {
    const { data: created, error } = await supabase
      .from("mission_attempts")
      .insert({ user_id: profile.id, mission_id: missionId })
      .select("*")
      .single();
    if (error && error.code !== "23505") throw new Error("Не удалось начать миссию.");
    attempt = (created as MissionAttemptRow | null) ?? (await fetchOpenAttempt(supabase, missionId));
  }
  if (!attempt) throw new Error("Не удалось начать миссию.");

  let updatedMission = mission;
  if (mission.status === "available") {
    const { data: started } = await supabase
      .from("missions")
      .update({ status: "started", started_at: new Date().toISOString() })
      .eq("id", missionId)
      .eq("user_id", profile.id)
      .select("*")
      .single();
    if (started) updatedMission = started as MissionRow;
  }

  revalidatePath(PATH);
  revalidatePath("/home");
  return { mission: updatedMission, attempt };
}

async function fetchOpenAttempt(supabase: Awaited<ReturnType<typeof createClient>>, missionId: string): Promise<MissionAttemptRow | null> {
  const { data } = await supabase.from("mission_attempts").select("*").eq("mission_id", missionId).is("completed_at", null).maybeSingle();
  return (data as MissionAttemptRow | null) ?? null;
}

export async function submitMissionStepAction(missionId: string, stepIndex: number, correct: boolean, answer: unknown): Promise<MissionAttemptRow | null> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const mission = await fetchOwnedMission(supabase, missionId, profile.id);
  if (!mission) return null;
  const attempt = await fetchOpenAttempt(supabase, missionId);
  if (!attempt) return null;

  // Monotonic current_step: a stale/duplicate resubmission of an earlier
  // step index is a no-op, never rewinds progress (plan doc §43).
  if (stepIndex < attempt.current_step) return attempt;

  const answers = [...(attempt.answers_json as unknown[])];
  answers[stepIndex] = answer;

  const { data: updated } = await supabase
    .from("mission_attempts")
    .update({
      current_step: Math.max(attempt.current_step, stepIndex + 1),
      correct_count: attempt.correct_count + (correct ? 1 : 0),
      incorrect_count: attempt.incorrect_count + (correct ? 0 : 1),
      answers_json: answers,
    })
    .eq("id", attempt.id)
    .eq("user_id", profile.id)
    .select("*")
    .single();

  return (updated as MissionAttemptRow | null) ?? attempt;
}

// Grammar-runner mission types have no real flashcard behind them — closest
// honest existing EvidenceSourceType is "correction_submission" (same
// rule-based-exercise family as Correction Input, gated by
// include_writing_exercises). Targeted mission types genuinely grade real
// flashcards, so they use "flashcard" (gated by include_review_history).
// No new source_type value is added to language_evidence's schema for this
// — see the Missions v1 final report for why that's a disclosed, deliberate
// scope decision, not an oversight.
const GRAMMAR_RUNNER_TYPES = new Set<MissionType>(["grammar_pattern", "correction", "diagnostic_followup", "maintenance"]);
function evidenceSourceTypeFor(missionType: MissionType): EvidenceSourceType {
  return GRAMMAR_RUNNER_TYPES.has(missionType) ? "correction_submission" : "flashcard";
}

export interface LanguageTwinMissionUpdate {
  patternTitle: string;
  category: string;
  status: string;
  trend: string;
}

export interface CompleteMissionResult {
  attempt: MissionAttemptRow;
  languageTwinUpdate: LanguageTwinMissionUpdate | null;
}

// Targeted mission types (vocab_activation/review_recovery/phrase_activation)
// never call submitMissionStepAction — they run through the existing Brain
// review flow instead, whose real per-card grade already lives in
// review_log via reviewWord(). finalCounts lets the review flow's own
// SessionComplete report that same genuine tally once, at session end,
// rather than mission code re-deriving or guessing a grade. Grammar-runner
// types never pass this — their attempt.correct_count/incorrect_count is
// already accurate from submitMissionStepAction, so it's used as-is.
export interface MissionFinalCounts {
  correct: number;
  incorrect: number;
}

export async function completeMissionAction(missionId: string, finalCounts?: MissionFinalCounts): Promise<CompleteMissionResult | null> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const mission = await fetchOwnedMission(supabase, missionId, profile.id);
  if (!mission) return null;
  const attempt = await fetchOpenAttempt(supabase, missionId);
  if (!attempt) {
    // Already completed by an earlier request (retry/double-click) — return
    // the existing completed attempt instead of erroring, so the client's
    // retry is idempotent too.
    const { data: last } = await supabase
      .from("mission_attempts")
      .select("*")
      .eq("mission_id", missionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return last ? { attempt: last as MissionAttemptRow, languageTwinUpdate: null } : null;
  }

  const now = new Date();
  const durationSeconds = Math.round((now.getTime() - new Date(attempt.started_at).getTime()) / 1000);
  const correctCount = finalCounts ? finalCounts.correct : attempt.correct_count;
  const incorrectCount = finalCounts ? finalCounts.incorrect : attempt.incorrect_count;

  const { data: completedAttemptRow } = await supabase
    .from("mission_attempts")
    .update({
      completed_at: now.toISOString(),
      duration_seconds: durationSeconds,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
    })
    .eq("id", attempt.id)
    .eq("user_id", profile.id)
    .select("*")
    .single();
  const completedAttempt = (completedAttemptRow as MissionAttemptRow | null) ?? attempt;

  await supabase.from("missions").update({ status: "completed", completed_at: now.toISOString() }).eq("id", missionId).eq("user_id", profile.id);

  // Atomic compare-and-set (plan doc §12/§23/§40): only the request that
  // flips evidence_generated false->true writes evidence — a retried or
  // racing completion request gets nothing back here and skips, so exactly
  // one mission_result row is ever created per attempt.
  let languageTwinUpdate: LanguageTwinMissionUpdate | null = null;
  const { data: claimed } = await supabase
    .from("mission_attempts")
    .update({ evidence_generated: true })
    .eq("id", attempt.id)
    .eq("evidence_generated", false)
    .select("id")
    .maybeSingle();

  if (claimed) {
    const total = completedAttempt.correct_count + completedAttempt.incorrect_count;
    const ratio = total > 0 ? completedAttempt.correct_count / total : 0;
    const confidence = ratio >= 0.8 ? "high" : ratio >= 0.5 ? "medium" : "low";

    await recordEvidence(supabase, {
      userId: profile.id,
      patternId: mission.source_pattern_id,
      evidenceType: "mission_result",
      sourceType: evidenceSourceTypeFor(mission.mission_type),
      sourceId: missionId,
      normalizedCategory: mission.skill_category,
      result: `${completedAttempt.correct_count}/${total}`,
      confidence,
      metadata: { missionType: mission.mission_type },
    });

    // Mission code never mutates language_error_patterns directly (plan doc
    // §22) — only ever evidence -> recompute -> the engine decides.
    await recomputeLanguageTwin(supabase, profile.id, profile.target_language);

    if (mission.source_pattern_id) {
      const { data: pattern } = await supabase
        .from("language_error_patterns")
        .select("title, category, status, trend")
        .eq("id", mission.source_pattern_id)
        .maybeSingle();
      if (pattern) {
        languageTwinUpdate = { patternTitle: pattern.title, category: pattern.category, status: pattern.status, trend: pattern.trend };
      }
    }
  }

  revalidatePath(PATH);
  revalidatePath("/home");
  revalidatePath("/language-twin");
  revalidatePath("/progress");
  return { attempt: completedAttempt, languageTwinUpdate };
}

export async function dismissMissionAction(missionId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  // Only ever dismisses an `available` mission — a `started` one is never
  // silently discarded by this action (plan doc §29's "warn about progress"
  // requirement is enforced client-side by not wiring this button while a
  // mission is started; this is the server-side backstop).
  await supabase
    .from("missions")
    .update({ status: "dismissed", dismissed_at: new Date().toISOString() })
    .eq("id", missionId)
    .eq("user_id", profile.id)
    .eq("status", "available");
  revalidatePath(PATH);
  revalidatePath("/home");
}

export async function getMissionHistoryAction(limit = 20): Promise<MissionRow[]> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("missions")
    .select("*")
    .eq("user_id", profile.id)
    .in("status", ["completed", "dismissed", "expired"])
    .order("generated_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as MissionRow[];
}
