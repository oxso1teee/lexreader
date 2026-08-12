import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { deriveOnboardingStep } from "./state.ts";
import { getLatestAttempt } from "@/lib/placement/persist.ts";
import { getActiveEnrollment, getSkillProgressForPath } from "@/lib/learning-paths/persist.ts";
import { getPath, findStageForSkill } from "@/lib/learning-paths/curriculum/index.ts";
import { findCurrentFocusSkill } from "@/lib/learning-paths/progress-engine.ts";

// M3 Slice 9 — server-side counterpart to src/lib/onboarding/state.ts's
// pure deriveOnboardingStep(). Queries the real rows, then maps the
// resulting step onto an actual URL. Used by the (app) layout gate (plan
// doc §11/§16) and by the onboarding pages themselves to self-resolve on
// load (covers refresh/re-login resume without any client-stored state).
//
// Returns null when the user is fully onboarded (completed_first_win) —
// callers should treat null as "let them through, no redirect needed".
export async function resolveOnboardingUrl(supabase: SupabaseServerClient, profile: Profile): Promise<string | null> {
  if (profile.completed_first_win) return null;

  const [latestAttempt, activeEnrollment] = await Promise.all([
    getLatestAttempt(supabase, profile.id),
    getActiveEnrollment(supabase, profile.id),
  ]);

  const derived = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: latestAttempt
      ? { status: latestAttempt.status, answeredCount: latestAttempt.answers_json.length }
      : null,
    hasActiveEnrollment: activeEnrollment !== null,
    completedFirstWin: false,
  });

  switch (derived.step) {
    case "no_account":
      // Unreachable here (profile already confirmed to exist by the
      // caller), kept only for exhaustiveness.
      return "/onboarding";
    case "placement_intro":
    case "placement_question":
      return "/onboarding/placement";
    case "result":
      return "/onboarding/result";
    case "first_action": {
      if (!activeEnrollment) return "/onboarding/result"; // defensive, shouldn't happen
      const path = getPath(activeEnrollment.path_slug);
      if (!path) return "/onboarding/result";
      const progressRows = await getSkillProgressForPath(supabase, profile.id, path.slug, path.version);
      const focusSkill = findCurrentFocusSkill(path, progressRows);
      if (!focusSkill) return "/onboarding/result"; // path already fully complete somehow — let result page handle it
      const stage = findStageForSkill(path, focusSkill.key);
      if (!stage) return "/onboarding/result";
      return `/learning-paths/${path.slug}/${stage.key}/${focusSkill.key}`;
    }
    case "complete":
      return null;
  }
}
