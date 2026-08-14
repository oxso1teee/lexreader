import test from "node:test";
import assert from "node:assert/strict";
import { createRequestState } from "./request-state.mjs";

test("request-state: starts idle", () => {
  const r = createRequestState();
  assert.equal(r.state, "idle");
});

test("request-state: follows the success path idle -> waiting -> captured -> resolved -> cleaned", () => {
  const r = createRequestState();
  assert.equal(r.transition("waiting"), true);
  assert.equal(r.transition("captured"), true);
  assert.equal(r.transition("resolved"), true);
  assert.equal(r.transition("cleaned"), true);
  assert.equal(r.state, "cleaned");
});

test("request-state: follows the failure path idle -> waiting -> failed -> cleaned", () => {
  const r = createRequestState();
  r.transition("waiting");
  assert.equal(r.transition("failed"), true);
  assert.equal(r.transition("cleaned"), true);
  assert.equal(r.state, "cleaned");
});

test("request-state: waiting can go straight to resolved/failed without passing through captured", () => {
  const r = createRequestState();
  r.transition("waiting");
  assert.equal(r.transition("resolved"), true);
});

test("request-state (lifecycle bug #3): once resolved, a late failed callback is rejected -- first valid result wins", () => {
  const r = createRequestState();
  r.transition("waiting");
  r.transition("captured");
  r.transition("resolved");
  assert.equal(r.transition("failed"), false);
  assert.equal(r.state, "resolved", "state must stay resolved, never flip to failed");
});

test("request-state (lifecycle bug #3): once failed, a late resolved callback is rejected", () => {
  const r = createRequestState();
  r.transition("waiting");
  r.transition("failed");
  assert.equal(r.transition("resolved"), false);
  assert.equal(r.state, "failed");
});

test("request-state (lifecycle bug #3): a duplicate transition into the same terminal state is rejected (only the first terminal result is accepted)", () => {
  const r = createRequestState();
  r.transition("waiting");
  assert.equal(r.transition("resolved"), true);
  assert.equal(r.transition("resolved"), false, "a second 'resolved' signal for the same request must be a no-op");
});

test("request-state: once cleaned, no further transitions are allowed", () => {
  const r = createRequestState();
  r.transition("waiting");
  r.transition("resolved");
  r.transition("cleaned");
  assert.equal(r.transition("waiting"), false);
  assert.equal(r.transition("resolved"), false);
  assert.equal(r.transition("cleaned"), false);
});

test("request-state: skipping straight from idle to resolved is rejected (no shortcut around waiting)", () => {
  const r = createRequestState();
  assert.equal(r.transition("resolved"), false);
  assert.equal(r.state, "idle");
});
