import { buildMissionFingerprint } from "./fingerprint.ts";
import { GRAMMAR_BANK_VERSION, buildGrammarQuestionSet } from "./grammar-bank.ts";
import { computeExpiresAt, deriveDifficulty, estimateMinutes } from "./lifecycle.ts";
import { GRAMMAR_RUNNER_MISSION_TYPES, type MissionPayload } from "./payload.ts";
import { selectMissionCandidates, type FingerprintedCandidate } from "./ranking.ts";
import type { MissionCandidateInput, MissionDraft, MissionHistoryEntry, MissionType } from "./types.ts";

const GRAMMAR_RUNNER_TYPES = new Set<MissionType>(GRAMMAR_RUNNER_MISSION_TYPES);

export const ALGORITHM_VERSION = 1;

// Fixed step counts per mission type — the same number every time a mission
// of that type is generated (plan doc §6: a mission's shape is frozen at
// generation time via payload_json, never re-derived later).
const STEP_COUNT: Record<MissionCandidateInput["missionType"], number> = {
  grammar_pattern: 5,
  correction: 5,
  diagnostic_followup: 5,
  maintenance: 3,
  vocab_activation: 5,
  review_recovery: 5,
  phrase_activation: 5,
  reading: 1,
  onboarding: 1,
};

// Pure — no I/O. Takes already-fetched candidates (from Language Twin
// patterns/recommendations) and this user's mission history, returns the
// deterministic set of missions to persist. The caller (a server action)
// owns fetching inputs and inserting the result; this function never
// touches Supabase, which is what makes it fully unit-testable without a
// database (plan doc §7 — same split as recompute.ts/recommendations.ts).
export function generateMissionDrafts(
  candidates: MissionCandidateInput[],
  history: MissionHistoryEntry[],
  now: Date = new Date(),
): MissionDraft[] {
  const fingerprinted: FingerprintedCandidate[] = candidates.map((candidate) => {
    const stepCount = STEP_COUNT[candidate.missionType];
    return {
      candidate,
      fingerprint: buildMissionFingerprint({
        missionType: candidate.missionType,
        sourcePatternId: candidate.sourcePatternId,
        sourceRecommendationId: candidate.sourceRecommendationId,
        skillCategory: candidate.skillCategory,
        algorithmVersion: ALGORITHM_VERSION,
      }),
      estimatedMinutes: estimateMinutes(candidate.missionType, stepCount),
    };
  });

  const selected = selectMissionCandidates(fingerprinted, history, now);

  return selected.map(({ candidate, fingerprint, estimatedMinutes: minutes, priority }) => {
    const stepCount = STEP_COUNT[candidate.missionType];
    return {
      missionType: candidate.missionType,
      sourcePatternId: candidate.sourcePatternId,
      sourceRecommendationId: candidate.sourceRecommendationId,
      title: candidate.title,
      reasonKey: candidate.reasonKey,
      skillCategory: candidate.skillCategory,
      difficulty: deriveDifficulty(candidate.severity, candidate.confidence),
      estimatedMinutes: minutes,
      stepCount,
      priority,
      fingerprint,
      payload: buildPayload(candidate, fingerprint, stepCount),
    };
  });
}

// The one place a mission's exact question set (or target flashcard ids)
// gets frozen into payload_json — seeded on the fingerprint so it's stable
// across retried/idempotent generation calls but still varies per user.
function buildPayload(candidate: MissionCandidateInput, fingerprint: string, stepCount: number): Record<string, unknown> {
  if (GRAMMAR_RUNNER_TYPES.has(candidate.missionType) && candidate.skillCategory) {
    const questions = buildGrammarQuestionSet(candidate.skillCategory, stepCount, fingerprint);
    const payload: MissionPayload = { kind: "grammar", bankVersion: GRAMMAR_BANK_VERSION, questions };
    return payload as unknown as Record<string, unknown>;
  }
  if (candidate.wordIds && candidate.wordIds.length > 0) {
    const payload: MissionPayload = { kind: "targeted", wordIds: candidate.wordIds };
    return payload as unknown as Record<string, unknown>;
  }
  return {};
}

export { computeExpiresAt };
