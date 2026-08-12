import type { PatternCategory } from "@/lib/language-twin/types";
import { PLACEMENT_TIER_WEIGHT, getPlacementQuestions } from "./question-bank.ts";
import type {
  PlacementAnswerRecord,
  PlacementCategoryScore,
  PlacementConfidence,
  PlacementRange,
  PlacementResult,
  SelfReportedCefr,
} from "./types.ts";

// M3 Slice 9 — deterministic placement scoring (plan doc §7). Pure, no I/O.
// Weighted, not raw percentage: a correct upper-tier answer is stronger
// evidence than an easy one. Foundation floor prevents a lucky upper-tier
// guess from overriding a shaky foundation (a real product requirement,
// not just a UX nicety — "8/10 easy-only ≠ B2" and its inverse).
const FOUNDATION_FLOOR_MISSES = 2;

function tierTotals(answers: PlacementAnswerRecord[]) {
  const byTier: Record<string, { correct: number; total: number }> = {
    foundational: { correct: 0, total: 0 },
    intermediate: { correct: 0, total: 0 },
    upper: { correct: 0, total: 0 },
  };
  answers.forEach((a) => {
    byTier[a.tier].total += 1;
    if (a.correct) byTier[a.tier].correct += 1;
  });
  return byTier;
}

function categoryScores(answers: PlacementAnswerRecord[]): Record<string, PlacementCategoryScore> {
  const byCategory: Record<string, PlacementCategoryScore> = {};
  answers.forEach((a) => {
    const s = byCategory[a.category] ?? { correct: 0, total: 0 };
    s.total += 1;
    if (a.correct) s.correct += 1;
    byCategory[a.category] = s;
  });
  return byCategory;
}

function rangeFromRatio(ratio: number): PlacementRange {
  if (ratio >= 0.85) return "B2+";
  if (ratio >= 0.6) return "B1–B2";
  if (ratio >= 0.35) return "A2–B1";
  return "A1–A2";
}

// Same 4-value bucket order as PlacementRange, used to detect a self-report
// vs placement conflict (plan doc §7/confidence) and, separately, by the
// onboarding result screen to render the honest-conflict message.
const RANGE_ORDER: PlacementRange[] = ["A1–A2", "A2–B1", "B1–B2", "B2+"];
const SELF_REPORT_TO_RANGE_INDEX: Record<SelfReportedCefr, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  unsure: 1,
};

export function scorePlacement(answers: PlacementAnswerRecord[], selfReportedCefr: SelfReportedCefr | null): PlacementResult {
  const totalQuestions = getPlacementQuestions().length;
  const byTier = tierTotals(answers);
  const byCategory = categoryScores(answers);

  let earned = 0;
  let possible = 0;
  (Object.keys(byTier) as (keyof typeof PLACEMENT_TIER_WEIGHT)[]).forEach((tier) => {
    const weight = PLACEMENT_TIER_WEIGHT[tier];
    earned += byTier[tier].correct * weight;
    possible += byTier[tier].total * weight;
  });
  const ratio = possible > 0 ? earned / possible : 0;
  const foundationMisses = byTier.foundational.total - byTier.foundational.correct;

  const range: PlacementRange = foundationMisses >= FOUNDATION_FLOOR_MISSES ? "A1–A2" : rangeFromRatio(ratio);

  const foundationTierInversion = foundationMisses > 0 && byTier.upper.correct >= 2;
  const isComplete = answers.length >= totalQuestions;

  let confidence: PlacementConfidence = "high";
  if (!isComplete) {
    confidence = "low";
  } else if (foundationTierInversion) {
    confidence = "medium";
  } else if (selfReportedCefr && selfReportedCefr !== "unsure") {
    const selfIdx = SELF_REPORT_TO_RANGE_INDEX[selfReportedCefr];
    const placementIdx = RANGE_ORDER.indexOf(range);
    if (Math.abs(selfIdx - placementIdx) >= 2) confidence = "medium";
  }

  const strongCategories: PatternCategory[] = [];
  const weakCategories: PatternCategory[] = [];
  Object.entries(byCategory).forEach(([category, score]) => {
    if (score.total === 0) return;
    if (score.correct === score.total) strongCategories.push(category as PatternCategory);
    else if (score.correct === 0) weakCategories.push(category as PatternCategory);
  });

  return {
    range,
    confidence,
    correctCount: answers.filter((a) => a.correct).length,
    questionCount: answers.length,
    categoryScores: byCategory,
    strongCategories,
    weakCategories,
  };
}

// Self-report vs placement conflict (plan doc §13) — 2+ bucket gap, same
// threshold the confidence calculation above already uses internally.
export function hasSelfReportConflict(range: PlacementRange, selfReportedCefr: SelfReportedCefr | null): boolean {
  if (!selfReportedCefr || selfReportedCefr === "unsure") return false;
  const selfIdx = SELF_REPORT_TO_RANGE_INDEX[selfReportedCefr];
  const placementIdx = RANGE_ORDER.indexOf(range);
  return selfIdx - placementIdx >= 2;
}

// Used by the skip-placement path (plan doc §14) — no test taken, so the
// range comes from self-report alone, always low/medium confidence, never
// "high" (that requires an actual completed placement). Deliberately its
// own mapping, not a reuse of SELF_REPORT_TO_RANGE_INDEX above: that index
// treats "B2" as the top of the scale for gap-detection math, but
// self-report alone should never claim the top range bucket "B2+" —
// that's reserved for demonstrated placement performance, so a bare "B2"
// self-report conservatively maps to "B1–B2" here.
const SELF_REPORT_TO_RANGE: Record<SelfReportedCefr, PlacementRange> = {
  A1: "A1–A2",
  A2: "A2–B1",
  B1: "B1–B2",
  B2: "B1–B2",
  unsure: "A2–B1",
};

export function rangeFromSelfReport(selfReportedCefr: SelfReportedCefr | null): PlacementRange {
  if (!selfReportedCefr) return "A2–B1";
  return SELF_REPORT_TO_RANGE[selfReportedCefr];
}
