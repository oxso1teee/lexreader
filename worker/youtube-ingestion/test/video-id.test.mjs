import test from "node:test";
import assert from "node:assert/strict";
import { extractVideoId, isValidVideoId, assertValidVideoId, canonicalWatchUrl, InvalidVideoIdError } from "../src/video-id.mjs";

test("extracts video ID from a normal watch URL", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=abcDEF_123-"), "abcDEF_123-");
});

test("extracts video ID from a youtu.be short URL", () => {
  assert.equal(extractVideoId("https://youtu.be/abcDEF_123-?t=10"), "abcDEF_123-");
});

test("extracts video ID from a Shorts URL", () => {
  assert.equal(extractVideoId("https://youtube.com/shorts/abcDEF_123-"), "abcDEF_123-");
});

test("extracts video ID from an embed URL", () => {
  assert.equal(extractVideoId("https://www.youtube.com/embed/abcDEF_123-"), "abcDEF_123-");
});

test("rejects a non-YouTube host even with a plausible-looking video param", () => {
  assert.equal(extractVideoId("https://example.com/watch?v=abcDEF_123-"), null);
});

test("rejects a host-allowlist bypass attempt (youtube.com.evil.tld)", () => {
  assert.equal(extractVideoId("https://youtube.com.evil.tld/watch?v=abcDEF_123-"), null);
});

test("rejects an unparseable URL", () => {
  assert.equal(extractVideoId("not a url at all"), null);
});

test("rejects a watch URL with a malformed video id", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=short"), null);
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=has spaces here"), null);
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=<script>alert(1)</script>"), null);
});

test("isValidVideoId enforces the exact length/character constraints", () => {
  assert.equal(isValidVideoId("abcDEF_123-"), true);
  assert.equal(isValidVideoId("short"), false); // < 6 chars
  assert.equal(isValidVideoId("a".repeat(21)), false); // > 20 chars
  assert.equal(isValidVideoId("has spaces"), false);
  assert.equal(isValidVideoId(""), false);
  assert.equal(isValidVideoId(null), false);
  assert.equal(isValidVideoId(undefined), false);
});

test("assertValidVideoId throws InvalidVideoIdError on a bad ID -- the defense-in-depth boundary before any shell arg is built", () => {
  assert.throws(() => assertValidVideoId("; rm -rf /"), InvalidVideoIdError);
  assert.throws(() => assertValidVideoId("$(whoami)"), InvalidVideoIdError);
  assert.doesNotThrow(() => assertValidVideoId("abcDEF_123-"));
});

test("canonicalWatchUrl builds a URL only from a validated ID, never from raw input", () => {
  assert.equal(canonicalWatchUrl("abcDEF_123-"), "https://www.youtube.com/watch?v=abcDEF_123-");
  assert.throws(() => canonicalWatchUrl("bad id; injected"), InvalidVideoIdError);
});
