"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { startPathAction } from "@/app/(app)/learning-paths/actions";
import { getPath, findStageForSkill } from "@/lib/learning-paths/curriculum/index.ts";
import { getSkillProgressForPath } from "@/lib/learning-paths/persist.ts";
import { findCurrentFocusSkill } from "@/lib/learning-paths/progress-engine.ts";
import type { PathSlug } from "@/lib/learning-paths/types";
import { captureServerEvent } from "@/lib/posthog-server";

// M3 Slice 9 (plan doc §12/§15/§16) — explicit, single deliberate click per
// path card; never silent. Reuses the real, unmodified Learning Paths
// enrollment action (one-primary-path invariant enforced there, not
// duplicated here) and lands the user on their actual first real Skill —
// never a fake onboarding-only exercise.
export async function confirmPathAction(pathSlug: PathSlug): Promise<void> {
  const path = getPath(pathSlug);
  if (!path) throw new Error("Неизвестный путь.");

  const profile = await requireProfile();
  const enrollment = await startPathAction(pathSlug);
  if (!enrollment) throw new Error("Не удалось начать путь.");

  captureServerEvent(profile.id, "learning_path_selected_from_onboarding", { path_slug: pathSlug });

  const supabase = await createClient();
  const progressRows = await getSkillProgressForPath(supabase, profile.id, path.slug, path.version);
  const focusSkill = findCurrentFocusSkill(path, progressRows);
  if (!focusSkill) {
    // Nothing left to require (shouldn't happen for a freshly-started
    // path) — fall back to the path's own real screen rather than a dead
    // end.
    redirect(`/learning-paths/${path.slug}`);
  }
  const stage = findStageForSkill(path, focusSkill.key);
  if (!stage) redirect(`/learning-paths/${path.slug}`);

  captureServerEvent(profile.id, "onboarding_first_action_started", { path_slug: pathSlug, skill_key: focusSkill.key });
  redirect(`/learning-paths/${path.slug}/${stage.key}/${focusSkill.key}`);
}
