import { createHash } from "node:crypto";
import type { MissionType } from "./types";

// Deterministic dedup key (plan doc §8/§11) — same inputs always produce the
// same fingerprint, so the database's partial unique index
// missions_active_fingerprint_idx(user_id, fingerprint) is what actually
// prevents two concurrent generation calls from creating duplicate active
// missions; this function only has to be pure and stable, never random.
export function buildMissionFingerprint(input: {
  missionType: MissionType;
  sourcePatternId?: string | null;
  sourceRecommendationId?: string | null;
  skillCategory?: string | null;
  algorithmVersion: number;
}): string {
  const target = input.sourcePatternId ?? input.sourceRecommendationId ?? "generic";
  const key = [input.missionType, target, input.skillCategory ?? "none", input.algorithmVersion].join(":");
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}
