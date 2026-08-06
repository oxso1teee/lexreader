import type { PatternRow, RecommendationDraft } from "./types";

// Deterministic pattern → action table (plan doc §8). Pure function —
// takes already-computed patterns, returns what to recommend. Never calls
// an external model; every recommendation traces to one specific pattern
// (or an explicit "not enough data yet" reason).
const MAX_RECOMMENDATIONS = 5;

export function buildRecommendations(
  patterns: PatternRow[],
  hasEnoughOverallEvidence: boolean,
): RecommendationDraft[] {
  const actionable = patterns.filter((p) => p.status === "active" || p.status === "uncertain");

  if (actionable.length === 0 && !hasEnoughOverallEvidence) {
    return [
      {
        recommendationType: "diagnostic",
        priority: "medium",
        reasonKey: "insufficient_evidence",
        actionType: "start_diagnostic",
        actionTarget: {},
      },
    ];
  }

  if (actionable.length === 0) {
    return [
      {
        recommendationType: "maintain",
        priority: "low",
        reasonKey: "no_active_patterns",
        actionType: "open_review",
        actionTarget: {},
      },
    ];
  }

  const sorted = [...actionable].sort((a, b) => {
    const weight = { high: 3, medium: 2, low: 1 } as const;
    return weight[b.severity] - weight[a.severity] || b.evidence_count - a.evidence_count;
  });

  const recs: RecommendationDraft[] = sorted.map((p) => {
    if (p.category === "activation") {
      return {
        recommendationType: "targeted_review",
        priority: p.severity === "high" ? "high" : "medium",
        reasonKey: "activation_gap",
        relatedPatternKey: p.pattern_key,
        actionType: "open_custom_session",
        actionTarget: { patternKey: p.pattern_key, mode: "cards" },
      };
    }
    if (p.category === "review_recall") {
      return {
        recommendationType: "targeted_review",
        priority: "medium",
        reasonKey: "repeated_failure",
        relatedPatternKey: p.pattern_key,
        actionType: "open_custom_session",
        actionTarget: { patternKey: p.pattern_key, mode: "cards" },
      };
    }
    return {
      recommendationType: "correction_practice",
      priority: "low",
      reasonKey: "grammar_pattern",
      relatedPatternKey: p.pattern_key,
      actionType: "open_correction_input",
      actionTarget: { category: p.category },
    };
  });

  return recs.slice(0, MAX_RECOMMENDATIONS);
}
