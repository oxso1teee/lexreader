import { buildGrammarQuestionSet } from "../missions/grammar-bank.ts";
import { PLACEMENT_VERSION, type PlacementQuestion, type PlacementTier } from "./types.ts";
import type { PatternCategory } from "@/lib/language-twin/types";

// M3 Slice 9 — Placement v2's fixed 10-question composition (plan doc §6).
// Reuses real GRAMMAR_QUESTION_BANK entries verbatim via
// buildGrammarQuestionSet — no duplicated question text, grammar-bank.ts
// itself untouched. Grammar Bank has no per-question difficulty tag, so
// the tier lives here, in this thin curation layer, not there.
//
// Composition is deliberately curated, not the full 12-category taxonomy:
// comparative/gerund_infinitive are left out of the fixed v1 set (thin
// pools, and 10 questions across 3 tiers already stretches the thinnest
// categories at 1 question each) — disclosed gap, not a silent omission.
interface PlacementSlot {
  tier: PlacementTier;
  category: PatternCategory;
  subTopic?: string;
}

const PLACEMENT_COMPOSITION: PlacementSlot[] = [
  { tier: "foundational", category: "tense", subTopic: "present_simple" },
  { tier: "foundational", category: "tense", subTopic: "present_continuous" },
  { tier: "foundational", category: "word_order" },
  { tier: "foundational", category: "question_formation" },
  { tier: "intermediate", category: "article" },
  { tier: "intermediate", category: "preposition" },
  { tier: "intermediate", category: "modal" },
  { tier: "upper", category: "passive" },
  { tier: "upper", category: "relative_clause" },
  { tier: "upper", category: "conditional" },
];

export const PLACEMENT_TIER_WEIGHT: Record<PlacementTier, number> = {
  foundational: 1,
  intermediate: 2,
  upper: 2.5,
};

// Deterministic — every user on PLACEMENT_VERSION sees the same 10
// questions in the same order (mirrors the Knowledge Check's own "same
// skill key -> same questions" precedent, src/app/(app)/learning-paths/
// [pathSlug]/[stageKey]/[skillKey]/check/page.tsx). One buildGrammarQuestionSet
// call per slot with a slot-specific seed so different categories don't
// collide on the same hash bucket.
export function getPlacementQuestions(): PlacementQuestion[] {
  const seedBase = `placement-v${PLACEMENT_VERSION}`;
  return PLACEMENT_COMPOSITION.map((slot) => {
    const seed = `${seedBase}:${slot.category}:${slot.subTopic ?? ""}`;
    const [q] = buildGrammarQuestionSet(slot.category, 1, seed, slot.subTopic);
    if (!q) {
      throw new Error(`Placement composition references an empty grammar-bank pool: ${slot.category}/${slot.subTopic ?? "(none)"}`);
    }
    return {
      id: q.id,
      tier: slot.tier,
      category: slot.category,
      subTopic: slot.subTopic,
      prompt: q.prompt,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    };
  });
}

export function findPlacementQuestion(questionId: string): PlacementQuestion | null {
  return getPlacementQuestions().find((q) => q.id === questionId) ?? null;
}
