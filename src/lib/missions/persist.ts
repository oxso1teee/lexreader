import type { SupabaseServerClient } from "@/lib/supabase/server";
import { log } from "../log.ts";
import { fetchMissionCandidates, fetchMissionHistory } from "./candidates.ts";
import { computeExpiresAt, generateMissionDrafts } from "./generator.ts";
import type { MissionRow } from "./types.ts";

export interface StartedMissionProgress {
  mission: MissionRow;
  currentStep: number;
  percent: number;
}

// Missions mockup alignment — /missions' hero banner needs an honest % for
// the one mission actually in progress. missions has no language column
// (supabase/migrations/0037_missions.sql) to filter on, so this mirrors
// fetchActiveMissions() below and filters by user_id only. Two conditions
// both have to hold for the banner to render at all (enforced by returning
// null, not a default/zero state, the moment either is missing):
//   1. a mission with status="started" actually exists;
//   2. it has a real mission_attempts row recording current_step -- a
//      mission can be "started" (server action flips the status) before
//      the player has answered anything and logged a first attempt row.
// mission_attempts has a partial unique index guaranteeing at most one
// open (completed_at is null) attempt per mission at a time, but ordering
// by created_at desc + limit 1 (not filtering on completed_at) is the
// literal "самая свежая запись" the task asked for and degrades safely
// even if an older completed attempt were ever left around.
export async function getStartedMissionProgress(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<StartedMissionProgress | null> {
  const { data: startedMission } = await supabase
    .from("missions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "started")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!startedMission) return null;

  const { data: attempt } = await supabase
    .from("mission_attempts")
    .select("current_step")
    .eq("mission_id", startedMission.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!attempt) return null;

  const stepCount = (startedMission as MissionRow).step_count;
  const percent = stepCount > 0 ? Math.min(100, Math.round((attempt.current_step / stepCount) * 100)) : 0;
  return { mission: startedMission as MissionRow, currentStep: attempt.current_step, percent };
}

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

// The DB-touching half of generation (plan doc §7/§20): on-demand,
// idempotent, never replaces a `started` mission, never regenerates while
// an `available` set is still fresh. Concurrent calls are safe — each row
// is inserted individually so a unique-fingerprint conflict on one
// candidate never blocks the others, and the final read is always the
// authoritative post-insert state rather than the just-generated draft.
export async function getOrGenerateActiveMissions(supabase: SupabaseServerClient, userId: string, language: string): Promise<MissionRow[]> {
  const active = await fetchActiveMissions(supabase, userId);

  const hasStarted = active.some((m) => m.status === "started");
  const newestGeneratedAt = active[0]?.generated_at;
  const isStale = !newestGeneratedAt || Date.now() - new Date(newestGeneratedAt).getTime() > STALE_AFTER_MS;

  if (active.length > 0 && (hasStarted || !isStale)) return active;

  const [candidates, history] = await Promise.all([
    fetchMissionCandidates(supabase, userId, language),
    fetchMissionHistory(supabase, userId),
  ]);
  const drafts = generateMissionDrafts(candidates, history);
  if (drafts.length === 0) return active; // honest empty state — never fabricate a mission

  const now = new Date();
  for (const draft of drafts) {
    const { error } = await supabase.from("missions").insert({
      user_id: userId,
      mission_type: draft.missionType,
      source_pattern_id: draft.sourcePatternId,
      source_recommendation_id: draft.sourceRecommendationId,
      title: draft.title,
      reason_key: draft.reasonKey,
      skill_category: draft.skillCategory,
      difficulty: draft.difficulty,
      estimated_minutes: draft.estimatedMinutes,
      step_count: draft.stepCount,
      priority: draft.priority,
      fingerprint: draft.fingerprint,
      payload_json: draft.payload,
      generated_at: now.toISOString(),
      expires_at: computeExpiresAt(draft.missionType, now).toISOString(),
    });
    // 23505 = unique_violation: a concurrent call already generated this
    // exact fingerprint — expected under a race, not an error worth logging.
    if (error && error.code !== "23505") {
      log.error({ kind: "mission_generation_insert_failed", message: `${draft.missionType}: ${error.message}` });
    }
  }

  return fetchActiveMissions(supabase, userId);
}

async function fetchActiveMissions(supabase: SupabaseServerClient, userId: string): Promise<MissionRow[]> {
  const { data } = await supabase
    .from("missions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["available", "started"])
    .order("generated_at", { ascending: false });
  return (data ?? []) as MissionRow[];
}

export interface MissionsCompletedThisWeek {
  completed: number;
  skillsTouched: number;
}

// Today v2 §5 / Progress: shared by both /home and /progress so the numbers
// can never quietly drift apart — same real "completed this week" rows,
// never a running total or a fabricated streak.
export async function getMissionsCompletedThisWeek(
  supabase: SupabaseServerClient,
  userId: string,
  weekStartIso: string,
): Promise<MissionsCompletedThisWeek> {
  const { data } = await supabase
    .from("missions")
    .select("skill_category")
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("completed_at", weekStartIso);
  const rows = data ?? [];
  return {
    completed: rows.length,
    skillsTouched: new Set(rows.map((r) => r.skill_category).filter((c): c is string => Boolean(c))).size,
  };
}
