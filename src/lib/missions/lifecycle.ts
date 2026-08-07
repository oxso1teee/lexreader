import type { ConfidenceLevel, Severity } from "@/lib/language-twin/types";
import type { MissionDifficulty, MissionRow, MissionType } from "./types";

// Deterministic lookup, not a fake ML prediction (plan doc §31). Reading/
// onboarding are flat-duration mission types (no discrete steps to scale
// with); the rest scale linearly per step. 5 grammar steps -> 4 min, 5
// vocab-recall steps -> 3 min, matching the approved audit's own examples.
const MINUTES_PER_STEP: Record<MissionType, number> = {
  grammar_pattern: 0.8,
  correction: 0.8,
  diagnostic_followup: 0.8,
  maintenance: 0.8,
  vocab_activation: 0.6,
  review_recovery: 0.6,
  phrase_activation: 0.6,
  reading: 5,
  onboarding: 5,
};

export function estimateMinutes(missionType: MissionType, stepCount: number): number {
  if (missionType === "reading" || missionType === "onboarding") return MINUTES_PER_STEP[missionType];
  return Math.max(1, Math.round(stepCount * MINUTES_PER_STEP[missionType]));
}

// plan doc's Q&A #6: high severity + high confidence is the only "hard"
// bucket, low+low is the only "easy" bucket — everything in between is
// medium. Deliberately coarse, no numeric score shown in UI.
export function deriveDifficulty(severity: Severity, confidence: ConfidenceLevel): MissionDifficulty {
  if (severity === "high" && confidence === "high") return "hard";
  if (severity === "low" && confidence === "low") return "easy";
  return "medium";
}

const PATTERN_EXPIRY_HOURS = 48;
const ONBOARDING_EXPIRY_HOURS = 24;

export function computeExpiresAt(missionType: MissionType, generatedAt: Date = new Date()): Date {
  const hours = missionType === "onboarding" ? ONBOARDING_EXPIRY_HOURS : PATTERN_EXPIRY_HOURS;
  return new Date(generatedAt.getTime() + hours * 60 * 60 * 1000);
}

// A `started` mission never auto-expires mid-session (plan doc §8/§13) —
// expiry only ever applies to missions still sitting `available`, checked
// at generation/list time, never during an active attempt.
export function isMissionExpired(mission: Pick<MissionRow, "status" | "expires_at">, now: Date = new Date()): boolean {
  if (mission.status !== "available") return false;
  return new Date(mission.expires_at).getTime() < now.getTime();
}
