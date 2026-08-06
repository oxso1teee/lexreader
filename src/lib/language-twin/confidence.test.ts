import { test } from "node:test";
import assert from "node:assert/strict";
import { computeConfidence } from "./confidence.ts";

test("computeConfidence: below the evidence floor is always low, regardless of consistency", () => {
  const now = new Date("2026-08-06T00:00:00Z");
  const signals = [
    { occurredAt: now, sourceType: "review", outcome: "success" as const },
    { occurredAt: now, sourceType: "review", outcome: "success" as const },
  ];
  const result = computeConfidence(signals, now);
  assert.equal(result.level, "low");
  assert.ok(result.reasons.includes("insufficient_evidence"));
});

test("computeConfidence: single-source evidence caps below high even with lots of consistent recent signals", () => {
  const now = new Date("2026-08-06T00:00:00Z");
  const signals = Array.from({ length: 12 }, () => ({
    occurredAt: now,
    sourceType: "review",
    outcome: "success" as const,
  }));
  const result = computeConfidence(signals, now);
  assert.notEqual(result.level, "high");
});

test("computeConfidence: two corroborating source types with consistent recent evidence reaches high", () => {
  const now = new Date("2026-08-06T00:00:00Z");
  const signals = [
    ...Array.from({ length: 6 }, () => ({ occurredAt: now, sourceType: "review", outcome: "success" as const })),
    ...Array.from({ length: 6 }, () => ({ occurredAt: now, sourceType: "reading", outcome: "success" as const })),
  ];
  const result = computeConfidence(signals, now);
  assert.equal(result.level, "high");
});

test("computeConfidence: conflicting outcomes lower confidence and surface the reason", () => {
  const now = new Date("2026-08-06T00:00:00Z");
  const signals = [
    { occurredAt: now, sourceType: "review", outcome: "success" as const },
    { occurredAt: now, sourceType: "review", outcome: "failure" as const },
    { occurredAt: now, sourceType: "reading", outcome: "success" as const },
    { occurredAt: now, sourceType: "reading", outcome: "failure" as const },
  ];
  const result = computeConfidence(signals, now);
  assert.ok(result.reasons.includes("conflicting_evidence"));
});

test("computeConfidence: old evidence decays and does not count as recently updated", () => {
  const now = new Date("2026-08-06T00:00:00Z");
  const old = new Date("2026-01-01T00:00:00Z");
  const signals = Array.from({ length: 5 }, () => ({
    occurredAt: old,
    sourceType: "review",
    outcome: "success" as const,
  }));
  const result = computeConfidence(signals, now);
  assert.ok(!result.reasons.includes("recently_updated"));
});
