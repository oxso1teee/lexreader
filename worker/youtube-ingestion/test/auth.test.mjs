import test from "node:test";
import assert from "node:assert/strict";
import { isAuthorized, WORKER_SECRET_HEADER } from "../src/auth.mjs";

function fakeRequest(headerValue) {
  return { headers: { get: (name) => (name.toLowerCase() === WORKER_SECRET_HEADER ? headerValue : null) } };
}

test("accepts a request with the exact matching secret", () => {
  assert.equal(isAuthorized(fakeRequest("correct-secret"), "correct-secret"), true);
});

test("rejects a request with a wrong secret", () => {
  assert.equal(isAuthorized(fakeRequest("wrong-secret"), "correct-secret"), false);
});

test("rejects a request with no header at all", () => {
  assert.equal(isAuthorized(fakeRequest(null), "correct-secret"), false);
});

test("rejects a request with an empty header", () => {
  assert.equal(isAuthorized(fakeRequest(""), "correct-secret"), false);
});

test("fails closed when the expected secret is not configured", () => {
  assert.equal(isAuthorized(fakeRequest("anything"), undefined), false);
  assert.equal(isAuthorized(fakeRequest("anything"), ""), false);
});

test("rejects a same-prefix, different-length secret (no early-exit info leak on length)", () => {
  assert.equal(isAuthorized(fakeRequest("correct"), "correct-secret"), false);
});
