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

const { isAllowedSender, canonicalWatchUrl, withTimeout, EMERGENCY_TIMEOUT_MS, isAllowedApiBase, handleWordTapTranslate } =
  await import("./background.mjs");

test("isAllowedSender accepts every allowed LexReader origin", () => {
  for (const url of [
    "https://lexreader.vercel.app/library/new",
    "https://lexreader.app/",
    "https://www.lexreader.app/library/new",
    "https://lexreader-focoqdkq7-meeeee4.vercel.app/library/new",
    "https://lexreader-mnzvtftfs-meeeee4.vercel.app/library/new",
    "https://lexreader-ctoczfjdx-meeeee4.vercel.app/library/new",
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
    "https://www.youtube.com/watch?v=abcDEF_123-&autoplay=0#lexreader-extraction",
  );
});

test("canonicalWatchUrl marks literal DOM-only runs so MAIN-world network capture stays disabled", () => {
  assert.equal(
    canonicalWatchUrl("PolmvqSxnbc", { domOnly: true }),
    "https://www.youtube.com/watch?v=PolmvqSxnbc&autoplay=0#lexreader-extraction-dom-only",
  );
});

test("the only global extraction ceiling is a large emergency timeout", () => {
  assert.equal(EMERGENCY_TIMEOUT_MS, 90_000);
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

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// isAllowedApiBase reuses the exact same ALLOWED_APP_ORIGINS as isAllowedSender
// above, so word-tap.js's background fetch can only ever reach a LexReader
// origin already trusted elsewhere in this manifest, never an arbitrary URL
// a user might paste into the popup's "Адрес LexReader" field.
test("isAllowedApiBase accepts every allowed LexReader origin", () => {
  assert.equal(isAllowedApiBase("https://lexreader.app"), true);
  assert.equal(isAllowedApiBase("https://lexreader.app/settings"), true);
  assert.equal(isAllowedApiBase("http://localhost:3000"), true);
});

test("isAllowedApiBase rejects an unrelated or malformed URL", () => {
  assert.equal(isAllowedApiBase("https://evil.example.com"), false);
  assert.equal(isAllowedApiBase("not a url"), false);
  assert.equal(isAllowedApiBase(undefined), false);
});

test("handleWordTapTranslate refuses to fetch when apiBaseUrl is outside the allowlist (no token leak to an arbitrary host)", async () => {
  const result = await handleWordTapTranslate({
    apiBaseUrl: "https://evil.example.com",
    apiToken: "lxr_ext_secret",
    body: { word: "hi" },
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 0);
});

test("handleWordTapTranslate posts to /api/extension/translate-and-save with the Bearer token and returns the parsed JSON body", async () => {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return {
      ok: true,
      status: 200,
      json: async () => ({ wordTranslation: "тест" }),
    };
  };
  try {
    const result = await handleWordTapTranslate({
      apiBaseUrl: "https://lexreader.app",
      apiToken: "lxr_ext_secret",
      body: { word: "test", sourceLang: "en", targetLang: "ru" },
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { wordTranslation: "тест" });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://lexreader.app/api/extension/translate-and-save");
    assert.equal(calls[0].init.headers.Authorization, "Bearer lxr_ext_secret");
    assert.deepEqual(JSON.parse(calls[0].init.body), { word: "test", sourceLang: "en", targetLang: "ru" });
  } finally {
    delete globalThis.fetch;
  }
});

test("handleWordTapTranslate surfaces a non-ok HTTP response instead of throwing", async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({ error: "Недействительный токен." }),
  });
  try {
    const result = await handleWordTapTranslate({
      apiBaseUrl: "https://lexreader.app",
      apiToken: "bad",
      body: { word: "test" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 401);
    assert.equal(result.body.error, "Недействительный токен.");
  } finally {
    delete globalThis.fetch;
  }
});

test("handleWordTapTranslate handles a network failure (fetch throws) without crashing the caller", async () => {
  globalThis.fetch = async () => {
    throw new Error("network down");
  };
  try {
    const result = await handleWordTapTranslate({
      apiBaseUrl: "https://lexreader.app",
      apiToken: "x",
      body: { word: "test" },
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, 0);
  } finally {
    delete globalThis.fetch;
  }
});
