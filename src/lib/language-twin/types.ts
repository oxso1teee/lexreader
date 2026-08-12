// M3 Slice 5 — shared types for the Language Twin engine. Mirrors the
// column names/enums fixed in supabase/migrations/0036_language_twin.sql —
// keep these in sync if the schema changes.

export type ConfidenceLevel = "low" | "medium" | "high";

export type PatternCategory =
  | "activation"
  | "review_recall"
  | "article"
  | "preposition"
  | "word_order"
  | "tense"
  | "passive"
  | "gerund_infinitive"
  | "possession"
  | "collocation"
  | "spelling"
  | "other"
  // M3 Slice 8 — added to close the Learning Paths taxonomy gap (plan doc
  // §4/§9, migration 0039): exactly 5 new values, no more — every one is
  // backed by real grammar-bank Mission coverage (see grammar-bank.ts).
  | "comparative"
  | "modal"
  | "relative_clause"
  | "conditional"
  | "question_formation";

export type PatternStatus = "active" | "improving" | "resolved" | "uncertain" | "dismissed";
export type Trend = "up" | "down" | "flat";
export type Severity = "low" | "medium" | "high";

export interface LanguageTwinSettings {
  user_id: string;
  enabled: boolean;
  include_review_history: boolean;
  include_reading_behavior: boolean;
  include_writing_exercises: boolean;
  include_saved_vocabulary: boolean;
  allow_diagnostic: boolean;
  algorithm_version: number;
}

export type EvidenceSourceType =
  | "flashcard"
  | "vocabulary_item"
  | "correction_submission"
  | "diagnostic_session"
  // M3 Slice 9 — Placement v2's completed attempts (migration 0040 widened
  // language_evidence's source_type check constraint to match).
  | "placement_session";

export interface EvidenceInput {
  userId: string;
  patternId?: string | null;
  evidenceType: string;
  sourceType: EvidenceSourceType;
  sourceId?: string | null;
  normalizedCategory?: string | null;
  result?: string | null;
  confidence: ConfidenceLevel;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

export interface EvidenceRow {
  id: string;
  user_id: string;
  pattern_id: string | null;
  evidence_type: string;
  source_type: EvidenceSourceType;
  source_id: string | null;
  normalized_category: string | null;
  result: string | null;
  confidence: ConfidenceLevel;
  metadata_json: Record<string, unknown>;
  occurred_at: string;
  created_at: string;
  deleted_at: string | null;
}

export interface PatternDraft {
  patternKey: string;
  category: PatternCategory;
  title: string;
  description: string;
  severity: Severity;
  evidenceCount: number;
  confidenceScore: number;
  confidence: ConfidenceLevel;
  trend: Trend;
  metadata?: Record<string, unknown>;
}

export interface PatternRow {
  id: string;
  user_id: string;
  category: PatternCategory;
  pattern_key: string;
  title: string;
  description: string;
  confidence: ConfidenceLevel;
  confidence_score: number;
  evidence_count: number;
  severity: Severity;
  trend: Trend;
  status: PatternStatus;
  first_seen_at: string;
  last_seen_at: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RecommendationDraft {
  recommendationType: string;
  priority: "high" | "medium" | "low";
  reasonKey: string;
  relatedPatternKey?: string | null;
  actionType: string;
  actionTarget: Record<string, unknown>;
}
