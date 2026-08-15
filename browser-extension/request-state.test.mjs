import test from "node:test";
import assert from "node:assert/strict";
import { createRequestState } from "./request-state.mjs";

function reachDomCollection(state) {
  assert.equal(state.transition("opening_video"), true);
  assert.equal(state.transition("opening_transcript"), true);
  assert.equal(state.transition("dom_collecting"), true);
}

test("request lifecycle: DOM-primary success path", () => {
  const state = createRequestState();
  reachDomCollection(state);
  assert.equal(state.settleSuccess(), true);
  assert.equal(state.transition("cleaned"), true);
  assert.equal(state.state, "cleaned");
});

test("request lifecycle: DOM failure may enter secondary network fallback", () => {
  const state = createRequestState();
  reachDomCollection(state);
  assert.equal(state.transition("dom_failed"), true);
  assert.equal(state.transition("network_fallback"), true);
  assert.equal(state.settleSuccess(), true);
  assert.equal(state.state, "resolved");
});

test("request lifecycle: one cold-page retry returns to DOM collection", () => {
  const state = createRequestState();
  reachDomCollection(state);
  assert.equal(state.transition("dom_retrying"), true);
  assert.equal(state.transition("opening_transcript"), true);
  assert.equal(state.transition("dom_collecting"), true);
  assert.equal(state.settleSuccess(), true);
});

test("request lifecycle: DOM success cannot become failure", () => {
  const state = createRequestState();
  reachDomCollection(state);
  assert.equal(state.settleSuccess(), true);
  assert.equal(state.settleFailure(), false);
  assert.equal(state.transition("network_fallback"), false);
  assert.equal(state.state, "resolved");
});

test("request lifecycle: network failure after DOM success is ignored", () => {
  const state = createRequestState();
  reachDomCollection(state);
  state.settleSuccess();
  assert.equal(state.transition("dom_failed"), false);
  assert.equal(state.transition("network_fallback"), false);
  assert.equal(state.settleFailure(), false);
  assert.equal(state.state, "resolved");
});

test("request lifecycle: a DOM-only failure can terminate without network fallback", () => {
  const state = createRequestState();
  reachDomCollection(state);
  state.transition("dom_failed");
  assert.equal(state.settleFailure(), true);
  assert.equal(state.state, "failed");
});

test("request lifecycle: a second request is independent", () => {
  const first = createRequestState();
  reachDomCollection(first);
  first.settleSuccess();
  first.transition("cleaned");

  const second = createRequestState();
  reachDomCollection(second);
  assert.equal(second.settleSuccess(), true);
  assert.equal(second.state, "resolved");
});

test("request lifecycle: terminal success cancels the emergency timeout", () => {
  const scheduled = new Map();
  let nextId = 1;
  const state = createRequestState("idle", {
    setTimer(callback) {
      const id = nextId++;
      scheduled.set(id, callback);
      return id;
    },
    clearTimer(id) {
      scheduled.delete(id);
    },
  });
  reachDomCollection(state);
  assert.equal(state.startEmergencyTimer(90_000, () => assert.fail("cancelled timer fired")), true);
  assert.equal(state.hasEmergencyTimer, true);
  assert.equal(state.settleSuccess(), true);
  assert.equal(state.hasEmergencyTimer, false);
  assert.equal(scheduled.size, 0);
});

test("request lifecycle: emergency callback runs only while active", () => {
  let callback;
  const state = createRequestState("idle", {
    setTimer(next) {
      callback = next;
      return 1;
    },
    clearTimer() {},
  });
  state.transition("opening_video");
  let fired = 0;
  state.startEmergencyTimer(90_000, () => { fired += 1; });
  callback();
  assert.equal(fired, 1);
});

test("request lifecycle: once cleaned, stale callbacks are rejected", () => {
  const state = createRequestState();
  reachDomCollection(state);
  state.settleSuccess();
  state.transition("cleaned");
  assert.equal(state.settleFailure(), false);
  assert.equal(state.settleSuccess(), false);
  assert.equal(state.transition("opening_video"), false);
});
