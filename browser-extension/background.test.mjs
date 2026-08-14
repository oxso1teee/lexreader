import test from "node:test";
import assert from "node:assert/strict";

// background.mjs registers chrome.runtime.onMessage.addListener at module
// top level (it's a real MV3 service worker entry point, always the entry
// module in production, never imported elsewhere) -- a minimal chrome stub
// must exist before import so that registration doesn't throw in plain
// Node. Dynamic import (not static) so this setup runs first.
globalThis.chrome = {
  runtime: { onMessage: { addListener: () => {} } },
};

const { isAllowedSender, canonicalWatchUrl, withTimeout } = await import("./background.mjs");

test("isAllowedSender accepts every allowed LexReader origin", () => {
  for (const url of [
    "https://lexreader.vercel.app/library/new",
    "https://lexreader.app/",
    "https://www.lexreader.app/library/new",
    "https://lexreader-focoqdkq7-meeeee4.vercel.app/library/new",
    "https://lexreader-mnzvtftfs-meeeee4.vercel.app/library/new",
    "http://localhost:3000/library/new",
    "http://127.0.0.1:3000/library/new",
  ]) {
    assert.equal(isAllowedSender({ url }), true, url);
  }
});

test("isAllowedSender rejects an unrelated origin", () => {
  assert.equal(isAllowedSender({ url: "https://evil.example.com/library/new" }), false);
});

test("isAllowedSender rejects a lookalike origin (subdomain/path trick)", () => {
  assert.equal(isAllowedSender({ url: "https://lexreader.app.evil.com/" }), false);
  assert.equal(isAllowedSender({ url: "https://evil.com/?u=lexreader.app" }), false);
});

test("isAllowedSender rejects a missing or malformed sender URL", () => {
  assert.equal(isAllowedSender({}), false);
  assert.equal(isAllowedSender({ url: "not a url" }), false);
  assert.equal(isAllowedSender(undefined), false);
});

test("canonicalWatchUrl builds a youtube.com watch URL with the extraction marker", () => {
  // RC extraction bug: the marker is what youtube-page-capture.js checks to
  // decide whether to hold the video paused for the extraction window --
  // only ever on tabs we created ourselves.
  assert.equal(
    canonicalWatchUrl("abcDEF_123-"),
    "https://www.youtube.com/watch?v=abcDEF_123-#lexreader-extraction",
  );
});

test("withTimeout resolves normally when the promise settles before the deadline", async () => {
  const result = await withTimeout(Promise.resolve("done"), 1000, new Error("should not fire"));
  assert.equal(result, "done");
});

test("withTimeout rejects with the timeout fallback when the promise never settles in time", async () => {
  const neverResolves = new Promise(() => {});
  const timeoutError = new Error("extraction_failed");
  await assert.rejects(() => withTimeout(neverResolves, 30, timeoutError), timeoutError);
});

test("withTimeout propagates the original rejection when the promise fails before the deadline", async () => {
  const realError = new Error("transcript_unavailable");
  await assert.rejects(() => withTimeout(Promise.reject(realError), 1000, new Error("timeout")), realError);
});
