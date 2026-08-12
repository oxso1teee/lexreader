import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLatestAttempt } from "@/lib/placement/persist";
import { getActiveEnrollment, getSkillProgressForPath } from "@/lib/learning-paths/persist.ts";
import { getPath, findStageForSkill } from "@/lib/learning-paths/curriculum/index.ts";
import { findCurrentFocusSkill } from "@/lib/learning-paths/progress-engine.ts";
import { scorePlacement, hasSelfReportConflict } from "@/lib/placement/scoring";
import { recommendPathFromPlacement } from "@/lib/learning-paths/recommendation";
import type { GoalId } from "@/lib/onboarding/goals";
import type { SelfReportedCefr } from "@/lib/placement/types";
import ResultView from "./result-view";

// M3 Slice 9 (plan doc §16) — self-resolves from real DB state on every
// load: an enrolled-but-not-yet-won user gets bounced straight to their
// real first Skill (resume-safe), a genuinely missing attempt goes back to
// the placement intro, and only a completed/skipped attempt with no
// enrollment yet actually renders the result/recommendation UI.
export default async function ResultPage() {
  const profile = await requireProfile();
  if (profile.completed_first_win) redirect("/home");

  const supabase = await createClient();
  const [attempt, activeEnrollment] = await Promise.all([
    getLatestAttempt(supabase, profile.id),
    getActiveEnrollment(supabase, profile.id),
  ]);

  if (activeEnrollment) {
    const path = getPath(activeEnrollment.path_slug);
    if (path) {
      const progressRows = await getSkillProgressForPath(supabase, profile.id, path.slug, path.version);
      const focusSkill = findCurrentFocusSkill(path, progressRows);
      const stage = focusSkill ? findStageForSkill(path, focusSkill.key) : null;
      if (focusSkill && stage) redirect(`/learning-paths/${path.slug}/${stage.key}/${focusSkill.key}`);
      redirect(`/learning-paths/${path.slug}`);
    }
  }

  if (!attempt || attempt.status === "in_progress") redirect("/onboarding/placement");

  const selfReportedCefr = attempt.self_reported_level_at_attempt as SelfReportedCefr | null;
  const primaryGoal = attempt.primary_goal_at_attempt as GoalId | null;

  const isSkipped = attempt.status === "skipped";
  const result = isSkipped ? null : scorePlacement(attempt.answers_json, selfReportedCefr);
  const recommendation = recommendPathFromPlacement({
    placementRange: result?.range ?? null,
    placementConfidence: result?.confidence ?? null,
    selfReportedCefr,
    primaryGoal,
  });
  const conflict = result ? hasSelfReportConflict(result.range, selfReportedCefr) : false;

  return (
    <ResultView
      isSkipped={isSkipped}
      result={result}
      recommendation={recommendation}
      hasConflict={conflict}
      selfReportedCefr={selfReportedCefr}
    />
  );
}
