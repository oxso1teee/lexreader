import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLatestAttempt } from "@/lib/placement/persist";
import { getActiveEnrollment } from "@/lib/learning-paths/persist";
import { getPlacementQuestions } from "@/lib/placement/question-bank";
import PlacementRunner from "./placement-runner";
import { captureServerEvent } from "@/lib/posthog-server";

// M3 Slice 9 (plan doc §16, §31 optional existing-user entry) — self-
// resolves from real DB state on every load, exactly like the (app) layout
// gate does, so a refresh or a re-login always lands correctly without any
// client-stored step.
//
// ?retake=1 (linked from Language Twin/Settings, never shown to a user
// mid-onboarding) is the one deliberate exception to every guard below —
// an already-onboarded user retaking Placement isn't "still doing
// onboarding": they keep their existing enrollment untouched and land back
// on Language Twin when done, not on the path-selection screen.
export default async function PlacementPage({
  searchParams,
}: {
  searchParams: Promise<{ retake?: string }>;
}) {
  const { retake } = await searchParams;
  const isRetake = retake === "1";

  const profile = await requireProfile();
  const supabase = await createClient();
  const [attempt, activeEnrollment] = await Promise.all([
    getLatestAttempt(supabase, profile.id),
    getActiveEnrollment(supabase, profile.id),
  ]);

  if (!isRetake) {
    if (profile.completed_first_win) redirect("/home");
    // Already enrolled (e.g. skipped placement earlier and picked a path) —
    // nothing left to do here.
    if (activeEnrollment) redirect("/onboarding/result");
    // A completed or skipped attempt with no enrollment yet means the
    // result screen is what's actually next.
    if (attempt && attempt.status !== "in_progress") redirect("/onboarding/result");
  }

  const questions = getPlacementQuestions().map(({ id, tier, category, prompt, options }) => ({ id, tier, category, prompt, options }));
  // Retake mode ignores an old completed/skipped attempt for start-state
  // purposes (always offers a fresh run) but still resumes a genuinely
  // interrupted retake.
  const hasStarted = isRetake ? attempt?.status === "in_progress" : attempt !== null;
  const resumeIndex = hasStarted ? (attempt?.answers_json.length ?? 0) : 0;

  // A page load that finds a genuinely in-progress attempt only happens on
  // an actual navigation/refresh into an existing session — this is what
  // "resumed" means (plan doc §15/§20), never fired for a same-session
  // client-side phase transition (that never re-runs this server component).
  if (hasStarted) {
    captureServerEvent(profile.id, "onboarding_resumed", { resume_question_index: resumeIndex });
  }

  return <PlacementRunner questions={questions} hasStarted={hasStarted} resumeIndex={resumeIndex} isRetake={isRetake} />;
}
