import test from "node:test";
import assert from "node:assert/strict";
import { waitForValue } from "./wait-for-value.mjs";

test("waitForValue resolves immediately when the value already exists", async () => {
  const start = Date.now();
  const result = await waitForValue(() => "already-here", 5000, 200);
  assert.equal(result, "already-here");
  assert.ok(Date.now() - start < 100, "should not wait a full poll tick for an immediate value");
});

test("waitForValue captures a value that arrives after a delay, before the deadline", async () => {
  let value = null;
  setTimeout(() => {
    value = "arrived-late";
  }, 250);
  const result = await waitForValue(() => value, 5000, 50);
  assert.equal(result, "arrived-late");
});

test("waitForValue resolves with null/falsy when nothing ever arrives before the timeout", async () => {
  const result = await waitForValue(() => null, 300, 50);
  assert.equal(result, null);
});

test("waitForValue keeps polling through falsy results until a later non-empty value succeeds", async () => {
  let attempts = 0;
  const getValue = () => {
    attempts += 1;
    return attempts >= 3 ? "third-time" : null;
  };
  const result = await waitForValue(getValue, 5000, 30);
  assert.equal(result, "third-time");
  assert.ok(attempts >= 3);
});

test("waitForValue never mistakes an empty string for a real value", async () => {
  // Empty string is falsy -- same rejection behavior as a genuinely missing
  // capture (RC extraction bug: "empty timedtext is rejected").
  const result = await waitForValue(() => "", 200, 50);
  assert.equal(result, "");
});
