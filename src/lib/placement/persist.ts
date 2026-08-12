import type { SupabaseServerClient } from "@/lib/supabase/server";
import { PLACEMENT_VERSION, type PlacementAnswerRecord, type PlacementConfidence, type PlacementRange, type SelfReportedCefr } from "./types.ts";
import { getPlacementQuestions } from "./question-bank.ts";
import type { GoalId } from "@/lib/onboarding/goals.ts";

// M3 Slice 9 Phase B — the DB-touching half of the placement engine
// (mirrors learning-paths/persist.ts's split from the pure logic in
// scoring.ts). Every function here trusts its caller (the server actions in
// src/app/onboarding/placement/actions.ts) to have already resolved
// `userId` from a real session — RLS is the backstop, not the only line of
// defense (plan doc §19 security).

export interface PlacementAttemptRow {
  id: string;
  user_id: string;
  version: number;
  status: "in_progress" | "completed" | "skipped";
  started_at: string;
  completed_at: string | null;
  question_count: number;
  correct_count: number;
  answers_json: PlacementAnswerRecord[];
  result_range: PlacementRange | null;
  confidence: PlacementConfidence | null;
  category_scores_json: Record<string, { correct: number; total: number }>;
  recommended_path_slug: string | null;
  self_reported_level_at_attempt: SelfReportedCefr | null;
  primary_goal_at_attempt: GoalId | null;
  created_at: string;
  updated_at: string;
}

export async function getLatestAttempt(supabase: SupabaseServerClient, userId: string): Promise<PlacementAttemptRow | null> {
  const { data } = await supabase
    .from("placement_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as PlacementAttemptRow | null) ?? null;
}

// Idempotent: a genuinely in_progress attempt is returned as-is (resume),
// never duplicated. Only creates a fresh row when there's no attempt yet or
// the most recent one is already completed/skipped (a deliberate retake).
export async function createOrResumeAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  primaryGoal: GoalId | null,
  selfReportedCefr: SelfReportedCefr | null,
): Promise<PlacementAttemptRow> {
  const latest = await getLatestAttempt(supabase, userId);
  if (latest && latest.status === "in_progress") return latest;

  const { data, error } = await supabase
    .from("placement_attempts")
    .insert({
      user_id: userId,
      version: PLACEMENT_VERSION,
      status: "in_progress",
      question_count: getPlacementQuestions().length,
      primary_goal_at_attempt: primaryGoal,
      self_reported_level_at_attempt: selfReportedCefr,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Не удалось начать диагностику: ${error.message}`);
  return data as PlacementAttemptRow;
}

// Appends one answer and persists immediately (plan doc §26 — incremental
// persistence, so a network blip mid-test loses nothing). Read-modify-write
// on answers_json since the JS client has no atomic jsonb-append helper;
// safe because placement is a single-user, single-session, strictly
// sequential flow (never concurrent writers for the same attempt).
export async function appendAnswer(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
  currentAnswers: PlacementAnswerRecord[],
  answer: PlacementAnswerRecord,
): Promise<PlacementAttemptRow> {
  const answers = [...currentAnswers, answer];
  const correctCount = answers.filter((a) => a.correct).length;
  const { data, error } = await supabase
    .from("placement_attempts")
    .update({ answers_json: answers, correct_count: correctCount, updated_at: new Date().toISOString() })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(`Не удалось сохранить ответ: ${error.message}`);
  return data as PlacementAttemptRow;
}

export interface AttemptCompletion {
  resultRange: PlacementRange;
  confidence: PlacementConfidence;
  categoryScores: Record<string, { correct: number; total: number }>;
  recommendedPathSlug: string;
}

export async function completeAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  attemptId: string,
  completion: AttemptCompletion,
): Promise<PlacementAttemptRow> {
  const { data, error } = await supabase
    .from("placement_attempts")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      result_range: completion.resultRange,
      confidence: completion.confidence,
      category_scores_json: completion.categoryScores,
      recommended_path_slug: completion.recommendedPathSlug,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(`Не удалось сохранить результат: ${error.message}`);
  return data as PlacementAttemptRow;
}

export async function skipAttempt(
  supabase: SupabaseServerClient,
  userId: string,
  primaryGoal: GoalId | null,
  selfReportedCefr: SelfReportedCefr | null,
): Promise<PlacementAttemptRow> {
  const { data, error } = await supabase
    .from("placement_attempts")
    .insert({
      user_id: userId,
      version: PLACEMENT_VERSION,
      status: "skipped",
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      question_count: 0,
      primary_goal_at_attempt: primaryGoal,
      self_reported_level_at_attempt: selfReportedCefr,
    })
    .select("*")
    .single();
  if (error) throw new Error(`Не удалось пропустить диагностику: ${error.message}`);
  return data as PlacementAttemptRow;
}
