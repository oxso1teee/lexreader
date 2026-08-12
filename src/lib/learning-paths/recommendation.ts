import type { PathSlug } from "./types";

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
