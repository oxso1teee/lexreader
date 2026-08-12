"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { createOrResumeAttempt, appendAnswer, completeAttempt, skipAttempt, getLatestAttempt } from "@/lib/placement/persist";
import { getPlacementQuestions } from "@/lib/placement/question-bank";
import { scorePlacement } from "@/lib/placement/scoring";
import { PLACEMENT_VERSION, type SelfReportedCefr } from "@/lib/placement/types";
import type { GoalId } from "@/lib/onboarding/goals";
import { recommendPathFromPlacement } from "@/lib/learning-paths/recommendation";
import { recordEvidence } from "@/lib/language-twin/evidence";
import { captureServerEvent } from "@/lib/posthog-server";

// M3 Slice 9 Phase B (plan doc §19/§27) — server-authoritative throughout:
// the client only ever sends a question id + a selected option index, never
// a score or a range. Every question served, every correctness check, and
// the final result are all computed here from the real question bank.

export interface StartPlacementResult {
  attemptId: string;
  resumeIndex: number;
}

export async function startPlacementAction(): Promise<StartPlacementResult> {
  const profile = await requireProfile();
  const supabase = await createClient();
  const attempt = await createOrResumeAttempt(
    supabase,
    profile.id,
    (profile.primary_goal as GoalId | null) ?? null,
    (profile.self_reported_cefr as SelfReportedCefr | null) ?? null,
  );
  if (attempt.answers_json.length === 0) {
    captureServerEvent(profile.id, "placement_started", { version: attempt.version });
  }
  return { attemptId: attempt.id, resumeIndex: attempt.answers_json.length };
}

export interface SubmitAnswerResult {
  nextIndex: number;
  isDone: boolean;
}

// Validates the question id belongs to the placement bank and matches the
// exact next expected slot (plan doc §27: "no arbitrary question ids", "no
// skipping ahead") — a client can only ever answer the question it was
// actually served, in order.
export async function submitPlacementAnswerAction(questionId: string, selectedIndex: number): Promise<SubmitAnswerResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const attempt = await getLatestAttempt(supabase, profile.id);
  if (!attempt || attempt.status !== "in_progress") {
    throw new Error("Нет активной попытки диагностики.");
  }

  const questions = getPlacementQuestions();
  const expectedIndex = attempt.answers_json.length;
  const expected = questions[expectedIndex];
  if (!expected || expected.id !== questionId) {
    throw new Error("Вопрос не соответствует ожидаемому — попробуй обновить страницу.");
  }

  const correct = selectedIndex === expected.correctIndex;
  const updated = await appendAnswer(supabase, profile.id, attempt.id, attempt.answers_json, {
    questionId: expected.id,
    category: expected.category,
    tier: expected.tier,
    correct,
  });

  captureServerEvent(profile.id, "placement_question_answered", {
    question_id: expected.id,
    difficulty_tier: expected.tier,
    correct,
  });

  const isDone = updated.answers_json.length >= questions.length;
  if (isDone) {
    await finalizePlacement(supabase, profile, updated.id, updated.answers_json, updated.self_reported_level_at_attempt, updated.primary_goal_at_attempt);
  }

  return { nextIndex: updated.answers_json.length, isDone };
}

async function finalizePlacement(
  supabase: SupabaseServerClient,
  profile: { id: string },
  attemptId: string,
  answers: Parameters<typeof scorePlacement>[0],
  selfReportedCefr: SelfReportedCefr | null,
  primaryGoal: GoalId | null,
) {
  const result = scorePlacement(answers, selfReportedCefr);
  const recommendation = recommendPathFromPlacement({
    placementRange: result.range,
    placementConfidence: result.confidence,
    selfReportedCefr,
    primaryGoal,
  });

  await completeAttempt(supabase, profile.id, attemptId, {
    resultRange: result.range,
    confidence: result.confidence,
    categoryScores: result.categoryScores,
    recommendedPathSlug: recommendation.primary,
  });

  // Language Twin bootstrap (plan doc §13/§18) — real existing evidence
  // pipeline, never a direct pattern mutation. Low confidence per row; the
  // corroboration rule in confidence.ts and the >=2-occurrence threshold in
  // recompute.ts both already guarantee one wrong Placement answer alone
  // can never become a visible pattern.
  for (const category of result.weakCategories) {
    await recordEvidence(supabase, {
      userId: profile.id,
      evidenceType: "placement_result",
      sourceType: "placement_session",
      normalizedCategory: category,
      result: "incorrect",
      confidence: "low",
      metadata: { attemptId },
    });
  }

  captureServerEvent(profile.id, "placement_completed", {
    version: PLACEMENT_VERSION,
    result_range: result.range,
    confidence: result.confidence,
  });
}

export async function skipPlacementAction(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await skipAttempt(
    supabase,
    profile.id,
    (profile.primary_goal as GoalId | null) ?? null,
    (profile.self_reported_cefr as SelfReportedCefr | null) ?? null,
  );
  captureServerEvent(profile.id, "placement_skipped", {});
  redirect("/onboarding/result");
}
