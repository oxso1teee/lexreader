import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExpiresAt, deriveDifficulty, estimateMinutes, isMissionExpired } from "./lifecycle.ts";

test("estimateMinutes: 5 grammar steps is approximately 4 minutes", () => {
  assert.equal(estimateMinutes("grammar_pattern", 5), 4);
});

test("estimateMinutes: 5 vocab-recall steps is approximately 3 minutes", () => {
  assert.equal(estimateMinutes("vocab_activation", 5), 3);
});

test("estimateMinutes: reading/onboarding are flat, ignore step count", () => {
  assert.equal(estimateMinutes("reading", 1), estimateMinutes("reading", 99));
  assert.equal(estimateMinutes("onboarding", 1), estimateMinutes("onboarding", 99));
});

test("estimateMinutes: never returns zero or negative", () => {
  assert.ok(estimateMinutes("maintenance", 1) >= 1);
});

test("deriveDifficulty: high severity + high confidence is hard", () => {
  assert.equal(deriveDifficulty("high", "high"), "hard");
});

test("deriveDifficulty: low severity + low confidence is easy", () => {
  assert.equal(deriveDifficulty("low", "low"), "easy");
});

test("deriveDifficulty: everything else is medium", () => {
  assert.equal(deriveDifficulty("high", "low"), "medium");
  assert.equal(deriveDifficulty("medium", "medium"), "medium");
  assert.equal(deriveDifficulty("low", "high"), "medium");
});

test("computeExpiresAt: pattern-based missions expire in 48h", () => {
  const gen = new Date("2026-01-01T00:00:00Z");
  const expires = computeExpiresAt("grammar_pattern", gen);
  assert.equal(expires.toISOString(), "2026-01-03T00:00:00.000Z");
});

test("computeExpiresAt: onboarding missions expire in 24h", () => {
  const gen = new Date("2026-01-01T00:00:00Z");
  const expires = computeExpiresAt("onboarding", gen);
  assert.equal(expires.toISOString(), "2026-01-02T00:00:00.000Z");
});

test("isMissionExpired: available mission past expires_at is expired", () => {
  const now = new Date("2026-01-05T00:00:00Z");
  assert.equal(isMissionExpired({ status: "available", expires_at: "2026-01-01T00:00:00Z" }, now), true);
});

test("isMissionExpired: available mission before expires_at is not expired", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  assert.equal(isMissionExpired({ status: "available", expires_at: "2026-01-05T00:00:00Z" }, now), false);
});

test("isMissionExpired: a started mission never auto-expires mid-session, even past its expires_at", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  assert.equal(isMissionExpired({ status: "started", expires_at: "2026-01-01T00:00:00Z" }, now), false);
});

test("isMissionExpired: completed/dismissed/expired/replaced missions are never re-flagged as expired", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  for (const status of ["completed", "dismissed", "expired", "replaced"] as const) {
    assert.equal(isMissionExpired({ status, expires_at: "2026-01-01T00:00:00Z" }, now), false);
  }
});
