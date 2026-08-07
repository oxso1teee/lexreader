// M3 Slice 6 — shared types for the Missions engine. Mirrors the column
// names/enums fixed in supabase/migrations/0037_missions.sql — keep these
// in sync if the schema changes.
import type { ConfidenceLevel, PatternCategory, PatternRow, Severity, Trend } from "@/lib/language-twin/types";

export type MissionType =
  | "grammar_pattern"
  | "vocab_activation"
  | "review_recovery"
  | "reading"
  | "phrase_activation"
  | "correction"
  | "diagnostic_followup"
  | "maintenance"
  | "onboarding";

export type MissionStatus = "available" | "started" | "completed" | "dismissed" | "expired" | "replaced";
export type MissionPriority = "high" | "medium" | "low";
export type MissionDifficulty = "easy" | "medium" | "hard";

export interface MissionRow {
  id: string;
  user_id: string;
  mission_type: MissionType;
  source_pattern_id: string | null;
  source_recommendation_id: string | null;
  title: string;
  reason_key: string;
  skill_category: PatternCategory | null;
  difficulty: MissionDifficulty;
  estimated_minutes: number;
  step_count: number;
  status: MissionStatus;
  priority: MissionPriority;
  fingerprint: string;
  payload_json: Record<string, unknown>;
  algorithm_version: number;
  generated_at: string;
  started_at: string | null;
  completed_at: string | null;
  dismissed_at: string | null;
  expires_at: string;
}

export interface MissionAttemptRow {
  id: string;
  user_id: string;
  mission_id: string;
  started_at: string;
  completed_at: string | null;
  correct_count: number;
  incorrect_count: number;
  duration_seconds: number | null;
  current_step: number;
  answers_json: unknown[];
  evidence_generated: boolean;
  created_at: string;
}

// A candidate the ranking model scores — either a real Language Twin
// pattern (most mission types) or a synthetic "generic" candidate (only
// `onboarding`, which has no pattern to point at).
export interface MissionCandidateInput {
  missionType: MissionType;
  sourcePatternId: string | null;
  sourceRecommendationId: string | null;
  skillCategory: PatternCategory | null;
  severity: Severity;
  confidence: ConfidenceLevel;
  trend: Trend;
  evidenceCount: number;
  updatedAt: string;
  title: string;
  reasonKey: string;
  wordIds?: string[];
}

export interface MissionDraft {
  missionType: MissionType;
  sourcePatternId: string | null;
  sourceRecommendationId: string | null;
  title: string;
  reasonKey: string;
  skillCategory: PatternCategory | null;
  difficulty: MissionDifficulty;
  estimatedMinutes: number;
  stepCount: number;
  priority: MissionPriority;
  fingerprint: string;
  payload: Record<string, unknown>;
}

// What the generator needs to know about a user's own recent mission
// history to enforce cooldown/dedup — deliberately narrow (just the columns
// ranking.ts actually reads), not a full MissionRow, so callers can pass a
// cheap projection instead of `select *`.
export interface MissionHistoryEntry {
  fingerprint: string;
  status: MissionStatus;
  completedAt: string | null;
  dismissedAt: string | null;
}

export function patternToCandidate(
  pattern: Pick<
    PatternRow,
    "id" | "category" | "title" | "severity" | "confidence" | "trend" | "evidence_count" | "updated_at"
  >,
  missionType: MissionType,
  reasonKey: string,
  wordIds?: string[],
): MissionCandidateInput {
  return {
    missionType,
    sourcePatternId: pattern.id,
    sourceRecommendationId: null,
    skillCategory: pattern.category,
    severity: pattern.severity,
    confidence: pattern.confidence,
    trend: pattern.trend,
    evidenceCount: pattern.evidence_count,
    updatedAt: pattern.updated_at,
    title: pattern.title,
    reasonKey,
    wordIds,
  };
}
