import { test } from "node:test";
import assert from "node:assert/strict";
import { generateExtensionToken, hashToken, last4 } from "./extension-tokens.ts";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3.
// verifyExtensionToken() needs a real Supabase service client (DB lookup) —
// covered by e2e/extension-translate-and-save.spec.ts instead, matching this
// repo's existing split between pure-logic unit tests and DB-backed e2e.

test("generateExtensionToken(): has the lxr_ext_ prefix", () => {
  const token = generateExtensionToken();
  assert.ok(token.startsWith("lxr_ext_"), `expected lxr_ext_ prefix, got: ${token}`);
});

test("generateExtensionToken(): two calls never collide", () => {
  const a = generateExtensionToken();
  const b = generateExtensionToken();
  assert.notEqual(a, b);
});

test("generateExtensionToken(): plaintext is long enough to be unguessable (32 random bytes)", () => {
  const token = generateExtensionToken();
  const random = token.slice("lxr_ext_".length);
  // base64url of 32 bytes — no padding — is 43 chars.
  assert.ok(random.length >= 40, `expected >=40 random chars, got ${random.length}`);
});

test("hashToken(): deterministic — same input always hashes the same", () => {
  const token = generateExtensionToken();
  assert.equal(hashToken(token), hashToken(token));
});

test("hashToken(): different tokens hash differently", () => {
  const a = generateExtensionToken();
  const b = generateExtensionToken();
  assert.notEqual(hashToken(a), hashToken(b));
});

test("hashToken(): output is a 64-char lowercase hex sha256 digest, never the plaintext", () => {
  const token = generateExtensionToken();
  const hash = hashToken(token);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, token);
});

test("last4(): returns exactly the trailing 4 characters", () => {
  assert.equal(last4("lxr_ext_abcd1234"), "1234");
});

test("last4(): never returns enough of the token to reconstruct it", () => {
  const token = generateExtensionToken();
  const tail = last4(token);
  assert.equal(tail.length, 4);
  assert.ok(token.length > 40, "sanity: token itself is long");
});
