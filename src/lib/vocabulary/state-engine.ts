// M3 Slice 10 (plan doc §4) — a vocabulary item's `learning_state` answers "how well does
// the user actually know this?", which is a separate question from FSRS/SM-2's "when should
// this be reviewed next?" (src/lib/fsrs.ts / src/lib/srs.ts). This module never reads or
// writes scheduler state — only review outcomes and mode provenance.

export type LearningState = "new" | "learning" | "familiar" | "active" | "maintenance";
export type PracticeMode = "cards" | "choice" | "type" | "match" | "build";

export interface ReviewSignal {
  grade: number; // 0-3, matches review_log.grade
  mode: PracticeMode | null; // null = historical review recorded before practice_mode existed
}

export interface VocabularySignals {
  /** Newest first. Only the most recent EVIDENCE_WINDOW reviews are considered — this bounded
   *  window is what gives the state hysteresis: one new failure can only displace the oldest
   *  review in the window, so it can never by itself erase two or more prior successes. */
  recentReviews: ReviewSignal[];
  /** Legacy SM-2 interval_days, or FSRS scheduled_days if FSRS is authoritative for this user. */
  intervalDays: number | null;
  fsrsStability: number | null;
}

const EVIDENCE_WINDOW = 6;
const MAINTENANCE_MIN_REVIEWS = 5;
const MAINTENANCE_MIN_INTERVAL_DAYS = 60;
const MAINTENANCE_MIN_FSRS_STABILITY = 60;
// Only Type is real production evidence: the user reproduces the answer from nothing.
// Cards is self-graded honesty, not verified production — real, but ambiguous — so it's
// grouped with Choice/Match (recognition-among-options) as "weak" evidence, never alone
// enough to promote to `active`. This matches the explicit product decision: multiple
// choice (or Cards) must never promote a word to active on its own.
// Build (letter-tile spelling) sits in the same weak-evidence bucket as Cards/Choice/Match:
// the letters are given, so it's reconstruction-among-options, not free production —
// closer to recognition than to Type's from-nothing recall.
const STRONG_RECALL_MODES: readonly PracticeMode[] = ["type"];
const WEAK_EVIDENCE_MODES: readonly PracticeMode[] = ["cards", "choice", "match", "build"];
const SUCCESS_GRADE_THRESHOLD = 2;

function isSuccess(review: ReviewSignal): boolean {
  return review.grade >= SUCCESS_GRADE_THRESHOLD;
}

export function deriveVocabularyState(signals: VocabularySignals): LearningState {
  const window = signals.recentReviews.slice(0, EVIDENCE_WINDOW);

  if (window.length === 0) return "new";

  const failures = window.filter((r) => !isSuccess(r)).length;

  const longStable =
    (signals.intervalDays ?? 0) >= MAINTENANCE_MIN_INTERVAL_DAYS ||
    (signals.fsrsStability ?? 0) >= MAINTENANCE_MIN_FSRS_STABILITY;
  if (window.length >= MAINTENANCE_MIN_REVIEWS && failures === 0 && longStable) {
    return "maintenance";
  }

  const strongRecallSuccesses = window.filter(
    (r) => r.mode !== null && STRONG_RECALL_MODES.includes(r.mode) && isSuccess(r),
  ).length;
  if (strongRecallSuccesses >= 2 && failures <= 1) return "active";

  const weakEvidenceSuccesses = window.filter(
    (r) => r.mode !== null && WEAK_EVIDENCE_MODES.includes(r.mode) && isSuccess(r),
  ).length;
  if (weakEvidenceSuccesses >= 2 || strongRecallSuccesses >= 1) return "familiar";

  return "learning";
}
