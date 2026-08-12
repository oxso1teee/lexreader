import type { PathSlug } from "./types";
import type { GoalId } from "@/lib/onboarding/goals";
import type { PlacementConfidence, PlacementRange, SelfReportedCefr } from "@/lib/placement/types";
import { rangeFromSelfReport } from "../placement/scoring.ts";

// M3 Slice 8 — deterministic path recommendation (plan doc's Path
// Catalog/recommendation section). Input is the same coarse, honest
// behavioral level range already shown on /language-twin
// (behavioralLevelRange) — never a fake precise CEFR number, never
// auto-enrolls, just a labeled suggestion the user can ignore.
export interface PathRecommendation {
  pathSlug: PathSlug;
  reason: string;
  lowConfidence: boolean;
}

export function recommendPath(behavioralLevelRange: string | null): PathRecommendation {
  switch (behavioralLevelRange) {
    case "A1–A2":
    case "A2–B1":
      return { pathSlug: "a2-b1", reason: `По твоей оценке уровня (${behavioralLevelRange}) этот путь подойдёт лучше всего.`, lowConfidence: false };
    case "B1–B2":
    case "B2+":
      // Plan doc: an advanced user with foundational gaps isn't blocked or
      // told "you're not B1" — B1→B2 also covers reinforcement of basics,
      // so it stays the honest recommendation rather than skipping ahead.
      return { pathSlug: "b1-b2", reason: `По твоей оценке уровня (${behavioralLevelRange}) этот путь подойдёт лучше всего.`, lowConfidence: false };
    default:
      return { pathSlug: "a2-b1", reason: "Хорошая отправная точка, если ты только начинаешь или пока не уверен(а) в своём уровне.", lowConfidence: true };
  }
}

// M3 Slice 9 — Placement v2's own recommendation (plan doc §12). Additive
// sibling to recommendPath() above, which stays untouched and keeps
// serving the Catalog page's own no-active-enrollment banner. Deliberately
// a separate function rather than widening recommendPath()'s signature:
// this one needs a goal-driven topical alternative, recommendPath() never
// did and still shouldn't.
export interface PathRecommendationV2 {
  primary: PathSlug;
  primaryReason: string[];
  alternative: PathSlug | null;
}

const RANGE_ORDER: PlacementRange[] = ["A1–A2", "A2–B1", "B1–B2", "B2+"];

// Goal -> topical alternative. Deliberately not exhaustive — study/
// reading_content/general get no forced alternative (plan doc §12/§15):
// Everyday/IT are honestly scoped to their own goals, not a catch-all.
const GOAL_TO_ALTERNATIVE: Partial<Record<GoalId, PathSlug>> = {
  everyday: "everyday",
  travel: "everyday",
  friends_international: "everyday",
  work_it: "it-english",
};

function primaryPathForRange(range: PlacementRange): PathSlug {
  const idx = RANGE_ORDER.indexOf(range);
  return idx <= 1 ? "a2-b1" : "b1-b2";
}

export function recommendPathFromPlacement(input: {
  placementRange: PlacementRange | null;
  placementConfidence: PlacementConfidence | null;
  selfReportedCefr: SelfReportedCefr | null;
  primaryGoal: GoalId | null;
}): PathRecommendationV2 {
  const range = input.placementRange ?? rangeFromSelfReport(input.selfReportedCefr);
  const primary = primaryPathForRange(range);
  const alternative = input.primaryGoal ? (GOAL_TO_ALTERNATIVE[input.primaryGoal] ?? null) : null;

  const primaryReason: string[] = [];
  if (input.placementRange) {
    primaryReason.push(`короткая диагностика: ${input.placementRange}`);
  } else {
    primaryReason.push(`само-оценка: ${input.selfReportedCefr ?? "не указана"} (диагностика пропущена — предварительная рекомендация)`);
  }
  if (input.primaryGoal) primaryReason.push(`цель указана в онбординге`);

  return { primary, primaryReason, alternative: alternative === primary ? null : alternative };
}
