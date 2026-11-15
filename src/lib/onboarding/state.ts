// M3 Slice 9 — onboarding resume, fully derived (plan doc §10/§16). No
// separately-stored "current step" enum: a stored step field can drift
// from what's actually true in the DB (e.g. a step says "placement" but
// the user already has an active enrollment from a previous session on
// another device). Instead, every call re-derives the step from the real
// rows a server action already has to fetch anyway.
//
// Pure, no I/O — the caller (a server action) queries `profiles`,
// `placement_attempts` (most recent row only, by started_at desc), and
// `learning_path_enrollments` (status = 'active'), then passes the
// results in here.
// docs/moments/ROADMAP.md, этап 7 — "result" теперь покрывает Placement-
// result -> Goal-pick -> Streak-commit (ни один из них не пишет
// отдельного "я на этом шаге" флага, только streak_goal_days в конце
// тройки — то же намеренное отсутствие хранимого under-шага, что раньше
// покрывало весь путь от result до клика "выбрать путь"). "first_text" —
// отдельный шаг, потому что streak_goal_days — настоящая, проверяемая
// отметка прогресса.
export type OnboardingStep = "no_account" | "placement_intro" | "placement_question" | "result" | "first_text" | "first_action" | "complete";

export interface LatestPlacementAttemptInput {
  status: "in_progress" | "completed" | "skipped";
  /** Count of questions already answered — also the 0-indexed position of
   *  the next unanswered question to resume at. */
  answeredCount: number;
}

export interface OnboardingStateInput {
  hasProfile: boolean;
  latestAttempt: LatestPlacementAttemptInput | null;
  hasActiveEnrollment: boolean;
  completedFirstWin: boolean;
  /** docs/moments/ROADMAP.md, этап 7 — profiles.streak_goal_days !== null
   *  (Streak-commit уже пройден). Нет enrollment-пути — new-онбординг
   *  заканчивается First-text, а не выбором Learning Path. */
  streakGoalSet: boolean;
}

export interface OnboardingStateResult {
  step: OnboardingStep;
  /** Only set when step === "placement_question". */
  resumeQuestionIndex?: number;
}

export function deriveOnboardingStep(input: OnboardingStateInput): OnboardingStateResult {
  // Grandfathering (plan doc §11): completed_first_win already true means
  // fully onboarded regardless of every other signal — this is the ONLY
  // check that must run first, so every pre-Slice-9 existing user (whose
  // latestAttempt/hasActiveEnrollment are both meaningless "false"/null)
  // lands on "complete" and is never routed into onboarding v2.
  if (input.completedFirstWin) return { step: "complete" };

  if (!input.hasProfile) return { step: "no_account" };

  // An active enrollment means the user already committed to a path —
  // takes priority over an in-progress placement retest (an unusual but
  // possible sequence: skip placement -> enroll from a preliminary
  // recommendation -> go back and retry placement before finishing the
  // first action). Resuming the already-chosen path beats re-surfacing an
  // interrupted retest.
  if (input.hasActiveEnrollment) return { step: "first_action" };

  if (!input.latestAttempt) return { step: "placement_intro" };

  if (input.latestAttempt.status === "in_progress") {
    return { step: "placement_question", resumeQuestionIndex: input.latestAttempt.answeredCount };
  }

  // completed or skipped, no active enrollment yet: streak_goal_days is
  // the one real checkpoint inside Placement-result -> Goal-pick ->
  // Streak-commit -> First-text — not set yet means "somewhere in the
  // first three, safe to restart from Placement-result"; set means
  // "only First-text left".
  if (!input.streakGoalSet) return { step: "result" };
  return { step: "first_text" };
}
