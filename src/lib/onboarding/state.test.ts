import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveOnboardingStep } from "./state.ts";

const BASE = { hasProfile: false, latestAttempt: null, hasActiveEnrollment: false, completedFirstWin: false };

test("no auth/profile at all -> no_account", () => {
  assert.equal(deriveOnboardingStep(BASE).step, "no_account");
});

test("existing-user grandfathering: completed_first_win=true short-circuits everything, even with no profile signal", () => {
  // Mirrors a pre-Slice-9 account: no placement attempt, no enrollment, but
  // completed_first_win was already true (backfilled by migration 0023, or
  // set by the old first-win tutorial). Must never be routed to onboarding v2.
  const result = deriveOnboardingStep({ ...BASE, hasProfile: true, completedFirstWin: true });
  assert.equal(result.step, "complete");
});

test("existing-user grandfathering: completed_first_win=true wins even if a stray active enrollment or attempt exists", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "in_progress", answeredCount: 3 },
    hasActiveEnrollment: true,
    completedFirstWin: true,
  });
  assert.equal(result.step, "complete");
});

test("profile exists, goal/level already submitted at signup, no placement attempt yet -> placement_intro", () => {
  const result = deriveOnboardingStep({ ...BASE, hasProfile: true });
  assert.equal(result.step, "placement_intro");
});

test("placement attempt in progress at question 6/10 -> placement_question, resumeQuestionIndex=6", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "in_progress", answeredCount: 6 },
    hasActiveEnrollment: false,
    completedFirstWin: false,
  });
  assert.equal(result.step, "placement_question");
  assert.equal(result.resumeQuestionIndex, 6);
});

test("placement attempt just started (0 answered) -> placement_question, resumeQuestionIndex=0", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "in_progress", answeredCount: 0 },
    hasActiveEnrollment: false,
    completedFirstWin: false,
  });
  assert.equal(result.step, "placement_question");
  assert.equal(result.resumeQuestionIndex, 0);
});

test("placement completed, no active enrollment yet -> result", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "completed", answeredCount: 10 },
    hasActiveEnrollment: false,
    completedFirstWin: false,
  });
  assert.equal(result.step, "result");
});

test("placement skipped, no active enrollment yet -> result (still shows a preliminary recommendation)", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "skipped", answeredCount: 0 },
    hasActiveEnrollment: false,
    completedFirstWin: false,
  });
  assert.equal(result.step, "result");
});

test("path selected, first action not completed -> first_action", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "completed", answeredCount: 10 },
    hasActiveEnrollment: true,
    completedFirstWin: false,
  });
  assert.equal(result.step, "first_action");
});

test("active enrollment present even with no placement attempt at all -> first_action (e.g. skip flow enrolled immediately)", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: null,
    hasActiveEnrollment: true,
    completedFirstWin: false,
  });
  assert.equal(result.step, "first_action");
});

test("ambiguous edge: active enrollment AND an in-progress retest attempt -> first_action wins (resume the committed path, not the retest)", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "in_progress", answeredCount: 4 },
    hasActiveEnrollment: true,
    completedFirstWin: false,
  });
  assert.equal(result.step, "first_action");
});

test("first win completed -> complete", () => {
  const result = deriveOnboardingStep({
    hasProfile: true,
    latestAttempt: { status: "completed", answeredCount: 10 },
    hasActiveEnrollment: true,
    completedFirstWin: true,
  });
  assert.equal(result.step, "complete");
});
