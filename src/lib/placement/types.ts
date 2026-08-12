import type { PatternCategory } from "@/lib/language-twin/types";
import type { GoalId } from "@/lib/onboarding/goals";

// M3 Slice 9 — Placement v2 (plan doc §6). Deterministic, no AI, no
// external API. Never claims an official CEFR level — every result is a
// coarse range, reusing the exact vocabulary already established by the
// Language Twin diagnostic (diagnosticLevelRange()).
export const PLACEMENT_VERSION = 1;

export type PlacementTier = "foundational" | "intermediate" | "upper";

// Same 4-bucket vocabulary as src/lib/language-twin/diagnostic.ts's
// diagnosticLevelRange() — deliberately not a 5th "A2" bucket, so a
// placement result and a diagnostic result are always directly comparable.
export type PlacementRange = "A1–A2" | "A2–B1" | "B1–B2" | "B2+";

export type PlacementConfidence = "low" | "medium" | "high";

export type SelfReportedCefr = "A1" | "A2" | "B1" | "B2" | "unsure";

export interface PlacementQuestion {
  /** Reuses the real GRAMMAR_QUESTION_BANK id verbatim — never a duplicate. */
  id: string;
  tier: PlacementTier;
  category: PatternCategory;
  subTopic?: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** What gets persisted per answer — never prompt/option text (plan doc §8). */
export interface PlacementAnswerRecord {
  questionId: string;
  category: PatternCategory;
  tier: PlacementTier;
  correct: boolean;
}

export interface PlacementCategoryScore {
  correct: number;
  total: number;
}

export interface PlacementResult {
  range: PlacementRange;
  confidence: PlacementConfidence;
  correctCount: number;
  questionCount: number;
  categoryScores: Record<string, PlacementCategoryScore>;
  strongCategories: PatternCategory[];
  weakCategories: PatternCategory[];
}

export interface PlacementRecommendationInput {
  /** Present when a completed placement attempt exists — takes priority. */
  placementRange: PlacementRange | null;
  placementConfidence: PlacementConfidence | null;
  selfReportedCefr: SelfReportedCefr | null;
  primaryGoal: GoalId | null;
}
