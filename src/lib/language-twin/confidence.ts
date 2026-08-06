import type { ConfidenceLevel } from "./types";

// Deliberately mirrors brain-stats.ts's MIN_ATTEMPTS_FOR_ACCURACY (=3) —
// same "don't trust a single data point" convention, kept as an independent
// constant here rather than importing a private const from an unrelated
// module. Below this many signals, confidence is always "low" regardless of
// what the rest of the formula would say.
const MIN_EVIDENCE_FOR_CONFIDENCE = 3;
// Evidence count beyond which more signals stop adding confidence — a
// deliberate cap so the score can never claim false precision from volume
// alone.
const EVIDENCE_TARGET = 10;
// Signals older than this contribute close to nothing to the recency
// component (half-life decay) — a pattern nobody has triggered in a month
// shouldn't read as freshly confirmed.
const RECENCY_HALF_LIFE_DAYS = 21;

export type SignalOutcome = "success" | "failure" | "neutral";

export interface ConfidenceSignal {
  occurredAt: string | Date;
  sourceType: string;
  outcome: SignalOutcome;
}

export interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  reasons: string[];
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, (a.getTime() - b.getTime()) / 86_400_000);
}

function levelFromScore(score: number): ConfidenceLevel {
  if (score >= 0.7) return "high";
  if (score >= 0.35) return "medium";
  return "low";
}

// Pure function — no I/O, fully unit-testable. Never returns a raw
// percentage for display; callers show `level` + `reasons`, not `score`
// (score exists only for internal ranking/sorting, per the plan doc's
// "never show false precision" rule).
export function computeConfidence(signals: ConfidenceSignal[], now: Date = new Date()): ConfidenceResult {
  if (signals.length < MIN_EVIDENCE_FOR_CONFIDENCE) {
    return { score: 0, level: "low", reasons: ["insufficient_evidence"] };
  }

  const evidenceComponent = Math.min(signals.length / EVIDENCE_TARGET, 1) * 0.5;

  const recencyWeights = signals.map((s) => {
    const age = daysBetween(now, new Date(s.occurredAt));
    return Math.exp((-Math.LN2 * age) / RECENCY_HALF_LIFE_DAYS);
  });
  const avgRecencyWeight = recencyWeights.reduce((a, b) => a + b, 0) / recencyWeights.length;
  const recencyComponent = avgRecencyWeight * 0.2;

  const nonNeutral = signals.filter((s) => s.outcome !== "neutral");
  let consistencyRatio = 1;
  if (nonNeutral.length > 0) {
    const successCount = nonNeutral.filter((s) => s.outcome === "success").length;
    const failureCount = nonNeutral.length - successCount;
    consistencyRatio = Math.max(successCount, failureCount) / nonNeutral.length;
  }
  const consistencyComponent = consistencyRatio * 0.3;

  const distinctSources = new Set(signals.map((s) => s.sourceType)).size;

  let score = evidenceComponent + recencyComponent + consistencyComponent;
  // Single-source evidence can't earn "high" on its own — corroboration
  // across at least two independent signal types is required, per the plan
  // doc's confidence model (§7).
  if (distinctSources < 2) score = Math.min(score, 0.69);
  score = Math.min(1, score);

  const reasons: string[] = [];
  if (evidenceComponent < 0.25) reasons.push("few_evidence");
  if (nonNeutral.length > 0 && consistencyRatio < 0.7) reasons.push("conflicting_evidence");
  if (nonNeutral.length > 0 && consistencyRatio >= 0.9) reasons.push("consistent_evidence");
  if (avgRecencyWeight > 0.6) reasons.push("recently_updated");
  if (reasons.length === 0) reasons.push("stable");

  return { score, level: levelFromScore(score), reasons };
}
