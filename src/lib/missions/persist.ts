import type { SupabaseServerClient } from "@/lib/supabase/server";
import { log } from "../log.ts";
import { fetchMissionCandidates, fetchMissionHistory } from "./candidates.ts";
import { computeExpiresAt, generateMissionDrafts } from "./generator.ts";
import type { MissionRow } from "./types.ts";

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
