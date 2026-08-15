import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function loadBridge() {
  const source = await readFile(new URL("./lexreader-bridge.js", import.meta.url), "utf8");
  const windowListeners = new Map();
  const runtimeListeners = [];
  const posted = [];
  const runtimeRequests = [];
  const fakeWindow = {
    location: { origin: "http://localhost:3000" },
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    },
    postMessage(message, origin) {
      posted.push({ message, origin });
    },
  };
  const chrome = {
    runtime: {
      lastError: null,
      sendMessage(message, callback) {
        if (message.type === "LEXREADER_YOUTUBE_BRIDGE_PING") {
          callback({ ok: true });
          return;
        }
        runtimeRequests.push({ message, callback });
      },
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        },
      },
    },
  };

  vm.runInNewContext(source, { window: fakeWindow, chrome, console, Set });
  return {
    posted,
    runtimeListeners,
    runtimeRequests,
    dispatchPageMessage(data) {
      for (const listener of windowListeners.get("message") ?? []) {
        listener({ source: fakeWindow, origin: fakeWindow.location.origin, data });
      }
    },
  };
}

test("origin bridge forwards one matching terminal success and explicitly ACKs requestId", async () => {
  const bridge = await loadBridge();
  bridge.dispatchPageMessage({
    source: "lexreader-web",
    type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST",
    requestId: "req-ack",
    url: "https://youtu.be/PolmvqSxnbc?si=share-token",
    targetLanguage: "en",
  });

  assert.equal(bridge.runtimeRequests.length, 1);
  assert.equal(bridge.runtimeRequests[0].message.requestId, "req-ack");

  let acknowledgement;
  bridge.runtimeListeners[0](
    {
      type: "LEXREADER_TRANSCRIPT_RESULT",
      requestId: "req-ack",
      result: {
        ok: true,
        transcript: { videoId: "PolmvqSxnbc", segments: [{ startMs: 0, endMs: 1, text: "metadata only" }] },
        diagnostics: { acquisitionSource: "dom", uniqueSegments: 1 },
      },
    },
    {},
    (response) => { acknowledgement = response; },
  );

  assert.equal(acknowledgement.ok, true);
  assert.equal(acknowledgement.requestId, "req-ack");
  assert.equal(
    bridge.posted.filter((entry) => entry.message.type === "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE").length,
    1,
  );

  // Releasing the original request channel after explicit delivery must not
  // post a second terminal result to the page.
  bridge.runtimeRequests[0].callback({
    ok: true,
    requestId: "req-ack",
    deliveredViaTabMessage: true,
  });
  assert.equal(
    bridge.posted.filter((entry) => entry.message.type === "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE").length,
    1,
  );
});

test("origin bridge rejects a stale terminal request instead of contaminating the active request", async () => {
  const bridge = await loadBridge();
  bridge.dispatchPageMessage({
    source: "lexreader-web",
    type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST",
    requestId: "req-current",
    url: "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    targetLanguage: "en",
  });

  let acknowledgement;
  bridge.runtimeListeners[0](
    { type: "LEXREADER_TRANSCRIPT_RESULT", requestId: "req-old", result: { ok: true } },
    {},
    (response) => { acknowledgement = response; },
  );

  assert.equal(acknowledgement.ok, false);
  assert.equal(acknowledgement.requestId, "req-old");
  assert.equal(acknowledgement.error, "stale_request");
  assert.equal(
    bridge.posted.filter((entry) => entry.message.type === "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE").length,
    0,
  );
});
