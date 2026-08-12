import type { PatternCategory } from "@/lib/language-twin/types";

// M3 Slice 8 — shared types for the static, versioned Learning Paths
// curriculum (plan doc §3/§4). The atomic unit is the Skill; Path/Stage/
// Module only group skills, they never carry independent progress or
// content of their own.

export type PathSlug = "a2-b1" | "b1-b2" | "everyday" | "it-english";

export interface LessonContent {
  objective: string;
  explanation: string;
  examples: string[];
  commonMistakes: string[];
}

export interface Skill {
  /** Namespaced, stable key — e.g. "grammar.articles". Never renamed once
   *  shipped (enrollment/progress rows reference it by string). */
  key: string;
  title: string;
  lesson: LessonContent;
  /** The Language Twin category this skill's evidence/confidence comes
   *  from, or null when no honest mapping exists yet (plan doc §5) —
   *  never guessed, never a category the skill isn't really tracked under. */
  category: PatternCategory | null;
  /** Narrows a shared category to one grammar-bank sub-topic (e.g.
   *  "present_simple" within "tense") — see grammar-bank.ts's subTopic. */
  subTopic?: string;
  /** Set only for the one skill type whose matching active Mission can't be
   *  found via `category` alone (phrase_activation missions carry a null
   *  skill_category) — see missions integration, §11 of the plan doc. */
  missionTypeHint?: "phrase_activation";
}

export interface Module {
  key: string;
  title: string;
  skills: Skill[];
}

export interface Stage {
  key: string;
  title: string;
  description: string;
  modules: Module[];
}

export interface LearningPath {
  slug: PathSlug;
  version: number;
  title: string;
  goal: string;
  levelFrom: string;
  levelTo: string;
  /** "grammar_foundation" paths are ordered grammar-first (A2→B1, B1→B2);
   *  "topic" paths are vocabulary/topic-first (Everyday, IT). Purely a
   *  display/copy hint, not a behavioral switch. */
  kind: "grammar_foundation" | "topic";
  stages: Stage[];
}

// M3 Slice 8 Phase B — mirrors supabase/migrations/0038_learning_paths.sql
// column-for-column (plan doc §9). Keep in sync if the schema changes.

export type EnrollmentStatus = "active" | "paused" | "completed";

export interface EnrollmentRow {
  id: string;
  user_id: string;
  path_slug: PathSlug;
  path_version: number;
  status: EnrollmentStatus;
  current_stage_key: string;
  current_module_key: string | null;
  started_at: string;
  completed_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export type SkillStatus =
  | "not_started"
  | "introduced"
  | "practicing"
  | "improving"
  | "confident"
  | "maintenance";

export type SkillConfidence = "low" | "medium" | "high";

export interface SkillProgressRow {
  id: string;
  user_id: string;
  path_slug: PathSlug;
  path_version: number;
  skill_key: string;
  status: SkillStatus;
  evidence_count: number;
  confidence: SkillConfidence;
  content_completed_at: string | null;
  last_practiced_at: string | null;
  knowledge_check_best_score: number | null;
  created_at: string;
  updated_at: string;
}
