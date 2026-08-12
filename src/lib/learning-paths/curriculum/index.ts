import type { LearningPath, PathSlug, Skill, Stage } from "../types.ts";
import { A2_B1_V1 } from "./a2-b1.v1.ts";
import { B1_B2_V1 } from "./b1-b2.v1.ts";
import { EVERYDAY_V1 } from "./everyday.v1.ts";
import { IT_ENGLISH_V1 } from "./it-english.v1.ts";

// M3 Slice 8 — the one place that knows about every shipped curriculum
// version. Enrollment rows reference a path by (slug, version); this
// registry is how a version gets resolved back to real content (plan doc
// §14 versioning). Adding v2 of a path later means adding a new export
// here, never mutating an existing one in place.
export const CURRICULA: Record<PathSlug, LearningPath> = {
  "a2-b1": A2_B1_V1,
  "b1-b2": B1_B2_V1,
  everyday: EVERYDAY_V1,
  "it-english": IT_ENGLISH_V1,
};

export function getPath(slug: PathSlug): LearningPath | null {
  return CURRICULA[slug] ?? null;
}

export function getAllPaths(): LearningPath[] {
  return Object.values(CURRICULA);
}

export function getAllSkills(path: LearningPath): Skill[] {
  return path.stages.flatMap((stage) => stage.modules.flatMap((mod) => mod.skills));
}

export function findSkill(path: LearningPath, skillKey: string): Skill | null {
  return getAllSkills(path).find((s) => s.key === skillKey) ?? null;
}

export function findStageForSkill(path: LearningPath, skillKey: string): Stage | null {
  return path.stages.find((stage) => stage.modules.some((m) => m.skills.some((s) => s.key === skillKey))) ?? null;
}

export function totalSkillCount(path: LearningPath): number {
  return getAllSkills(path).length;
}

// Security (plan doc §13): the one honest source of truth for "does this
// path_slug/skill_key pair actually exist" — every server action that
// touches enrollment/progress calls this before trusting client input,
// never trusts a client-supplied skill_key on its own.
export function isValidSkillForPath(slug: PathSlug, skillKey: string): boolean {
  const path = getPath(slug);
  if (!path) return false;
  return findSkill(path, skillKey) !== null;
}
