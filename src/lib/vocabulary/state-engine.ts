// M3 Slice 10 (plan doc §4) — a vocabulary item's `learning_state` answers "how well does
// the user actually know this?", which is a separate question from FSRS/SM-2's "when should
// this be reviewed next?" (src/lib/fsrs.ts / src/lib/srs.ts). This module never reads or
// writes scheduler state — only review outcomes and mode provenance.

export type LearningState = "new" | "learning" | "familiar" | "active" | "maintenance";
export type PracticeMode = "cards" | "choice" | "type" | "match";

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
const RECALL_MODES: readonly PracticeMode[] = ["cards", "type"];
const RECOGNITION_MODES: readonly PracticeMode[] = ["choice", "match"];
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

  const recallSuccesses = window.filter((r) => r.mode !== null && RECALL_MODES.includes(r.mode) && isSuccess(r)).length;
  if (recallSuccesses >= 2 && failures <= 1) return "active";

  const recognitionSuccesses = window.filter(
    (r) => r.mode !== null && RECOGNITION_MODES.includes(r.mode) && isSuccess(r),
  ).length;
  if (recognitionSuccesses >= 2 || recallSuccesses >= 1) return "familiar";

  return "learning";
}
