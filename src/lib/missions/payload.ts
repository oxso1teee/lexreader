import type { GrammarQuestion } from "./grammar-bank.ts";

// The frozen shape of missions.payload_json — a discriminated union so the
// Mission Player can render the right UI without guessing. "Frozen" means
// literally: these exact questions/wordIds are written once at generation
// time and never recomputed from a "live" bank/pattern state (plan doc §6).
export interface GrammarMissionPayload {
  kind: "grammar";
  bankVersion: number;
  questions: GrammarQuestion[];
}

export interface TargetedMissionPayload {
  kind: "targeted";
  wordIds: string[];
}

export type MissionPayload = GrammarMissionPayload | TargetedMissionPayload;

export const GRAMMAR_RUNNER_MISSION_TYPES = ["grammar_pattern", "correction", "diagnostic_followup", "maintenance"] as const;
export const TARGETED_MISSION_TYPES = ["vocab_activation", "review_recovery", "phrase_activation"] as const;
