import type { ConfidenceLevel, Severity } from "@/lib/language-twin/types";
import type { MissionCandidateInput, MissionHistoryEntry, MissionPriority, MissionType } from "./types";

// plan doc §8/§12 — cooldown windows read from the user's own mission
// history, no separate cooldown table.
export const COOLDOWN_COMPLETED_MS = 12 * 60 * 60 * 1000;
export const COOLDOWN_DISMISSED_MS = 48 * 60 * 60 * 1000;
export const MAX_ACTIVE_MISSIONS = 3;
const RECENCY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const LONG_MISSION_MINUTES_THRESHOLD = 5;

const SEVERITY_WEIGHT: Record<Severity, number> = { high: 3, medium: 2, low: 1 };
const CONFIDENCE_WEIGHT: Record<ConfidenceLevel, number> = { high: 2, medium: 1, low: 0 };

export function isUnderCooldown(entry: MissionHistoryEntry, now: Date = new Date()): boolean {
  if (entry.status === "completed" && entry.completedAt) {
    if (now.getTime() - new Date(entry.completedAt).getTime() < COOLDOWN_COMPLETED_MS) return true;
  }
  if (entry.status === "dismissed" && entry.dismissedAt) {
    if (now.getTime() - new Date(entry.dismissedAt).getTime() < COOLDOWN_DISMISSED_MS) return true;
  }
  return false;
}

// Deliberate simplification of the audit's "excessive-duration penalty":
// scored per-candidate against a fixed threshold (not a running cumulative
// total across the selection), so score stays a stable, order-independent
// property of the candidate alone rather than depending on what's already
// been picked. Cumulative daily-workload limiting is what MAX_ACTIVE_MISSIONS
// (hard cap 3) already does.
export function scoreCandidate(candidate: MissionCandidateInput, estimatedMinutes: number, now: Date = new Date()): number {
  let score = SEVERITY_WEIGHT[candidate.severity] + CONFIDENCE_WEIGHT[candidate.confidence];
  if (now.getTime() - new Date(candidate.updatedAt).getTime() < RECENCY_WINDOW_MS) score += 1;
  if (estimatedMinutes > LONG_MISSION_MINUTES_THRESHOLD) score -= 1;
  return score;
}

export function priorityForCandidate(candidate: MissionCandidateInput): MissionPriority {
  if (candidate.severity === "high" && candidate.confidence !== "low") return "high";
  if (candidate.trend === "up" || candidate.confidence === "low") return "low";
  return "medium";
}

export interface FingerprintedCandidate {
  candidate: MissionCandidateInput;
  fingerprint: string;
  estimatedMinutes: number;
}

export interface ScoredCandidate extends FingerprintedCandidate {
  score: number;
  priority: MissionPriority;
}

// Deterministic selection (plan doc §7/§9): exclude anything under cooldown,
// score the rest, sort desc, then greedily take the top candidates subject
// to two hard rules — max 3 active missions, and never two missions for the
// same source_pattern_id at once. Stable sort (Array.prototype.sort is
// guaranteed stable per spec) means candidates with equal scores keep their
// input order, which callers should make deterministic (e.g. by pattern
// last_seen_at desc) so results don't vary run-to-run.
export function selectMissionCandidates(
  candidates: FingerprintedCandidate[],
  history: MissionHistoryEntry[],
  now: Date = new Date(),
): ScoredCandidate[] {
  const historyByFingerprint = new Map(history.map((h) => [h.fingerprint, h]));

  const eligible = candidates.filter((c) => {
    const past = historyByFingerprint.get(c.fingerprint);
    return !past || !isUnderCooldown(past, now);
  });

  const scored: ScoredCandidate[] = eligible.map((c) => ({
    ...c,
    score: scoreCandidate(c.candidate, c.estimatedMinutes, now),
    priority: priorityForCandidate(c.candidate),
  }));

  scored.sort((a, b) => b.score - a.score);

  const selected: ScoredCandidate[] = [];
  const usedPatternIds = new Set<string>();
  for (const c of scored) {
    if (selected.length >= MAX_ACTIVE_MISSIONS) break;
    const patternId = c.candidate.sourcePatternId;
    if (patternId && usedPatternIds.has(patternId)) continue;
    selected.push(c);
    if (patternId) usedPatternIds.add(patternId);
  }
  return selected;
}

export type { MissionType };
