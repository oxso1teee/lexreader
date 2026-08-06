import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRecommendations } from "./recommendations.ts";
import type { PatternRow } from "./types.ts";

function pattern(overrides: Partial<PatternRow>): PatternRow {
  return {
    id: "p1",
    user_id: "u1",
    category: "activation",
    pattern_key: "activation_default",
    title: "Title",
    description: "Description",
    confidence: "medium",
    confidence_score: 0.5,
    evidence_count: 5,
    severity: "medium",
    trend: "flat",
    status: "active",
    first_seen_at: "2026-07-01T00:00:00Z",
    last_seen_at: "2026-08-01T00:00:00Z",
    metadata_json: {},
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

test("buildRecommendations: no patterns and no evidence suggests the diagnostic", () => {
  const recs = buildRecommendations([], false);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].recommendationType, "diagnostic");
});

test("buildRecommendations: no active patterns but enough evidence suggests maintaining", () => {
  const recs = buildRecommendations([pattern({ status: "resolved" })], true);
  assert.equal(recs.length, 1);
  assert.equal(recs[0].recommendationType, "maintain");
});

test("buildRecommendations: activation pattern maps to a targeted review session", () => {
  const recs = buildRecommendations([pattern({ category: "activation", pattern_key: "act1" })], true);
  assert.equal(recs[0].recommendationType, "targeted_review");
  assert.equal(recs[0].relatedPatternKey, "act1");
});

test("buildRecommendations: grammar pattern maps to correction practice", () => {
  const recs = buildRecommendations(
    [pattern({ category: "preposition", pattern_key: "prep1" })],
    true,
  );
  assert.equal(recs[0].recommendationType, "correction_practice");
});

test("buildRecommendations: high severity is prioritized ahead of lower severity", () => {
  const recs = buildRecommendations(
    [
      pattern({ category: "activation", pattern_key: "low1", severity: "low", evidence_count: 3 }),
      pattern({ category: "activation", pattern_key: "high1", severity: "high", evidence_count: 3 }),
    ],
    true,
  );
  assert.equal(recs[0].relatedPatternKey, "high1");
});

test("buildRecommendations: dismissed patterns are excluded", () => {
  const recs = buildRecommendations([pattern({ status: "dismissed" })], true);
  assert.equal(recs[0].recommendationType, "maintain");
});

test("buildRecommendations: caps the list at 5", () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    pattern({ pattern_key: `p${i}`, category: "activation" }),
  );
  const recs = buildRecommendations(many, true);
  assert.equal(recs.length, 5);
});
