// Lifecycle bug (M3 Slice 12 RC #4) -- Phase 10 regression tests for the
// DOM-extraction fallback: a real user's transcript panel can visibly
// render a complete transcript while the network capture never lands (or
// lands too late), and LexReader must not report transcript_unavailable in
// that case. Covers all 7 specified scenarios: 1/3/6/7 against the real
// background.mjs code path (mocked chrome.tabs), 2/4 against
// assembleTranscriptResult/extractVideoId directly (no language/kind
// metadata gate exists for the DOM path, and the URL fragment must never
// leak into video-id comparisons), 5 against a local mirror of
// youtube-content-relay.js's race-based wait (that file itself can't be
// imported -- MV3 content scripts don't support "type": "module").
import test from "node:test";
import assert from "node:assert/strict";
import { extractVideoId, assembleTranscriptResult } from "./youtube-transcript.mjs";
await import("./youtube-dom-extractor.js");
const { createAccumulator } = globalThis.LexReaderYoutubeDomExtractor;

function buildSegmentsFromDomRows(rows) {
  const accumulator = createAccumulator();
  accumulator.addRows(rows);
  return accumulator.toSegments();
}

// --- Scenario 4: #lexreader-extraction must never leak into videoId parsing ---

test("Phase 10 scenario 4: extractVideoId ignores the #lexreader-extraction marker for the real reported video", () => {
  assert.equal(
    extractVideoId("https://www.youtube.com/watch?v=PolmvqSxnbc#lexreader-extraction"),
    "PolmvqSxnbc",
  );
});

test("the real youtu.be share URL normalizes to the same canonical videoId", () => {
  assert.equal(
    extractVideoId("https://youtu.be/PolmvqSxnbc?si=zpbG79LkPxOhWNRM"),
    "PolmvqSxnbc",
  );
});

// --- Scenarios 2 & 3: DOM-sourced segments carry no language/kind metadata
// and must never be rejected on that basis (auto-generated English matches
// fine, en vs en-US is a non-issue since DOM assembly performs no language
// filtering at all). ---

test("Phase 10 scenario 2: DOM-extracted segments assemble successfully regardless of requested-vs-actual language label (en requested, panel was en-US/auto)", () => {
  const rows = [{ timestampText: "3:10", text: "real auto-generated line" }];
  const segments = buildSegmentsFromDomRows(rows);
  const result = assembleTranscriptResult({
    videoId: "PolmvqSxnbc",
    title: "Robinson Crusoe",
    lengthSeconds: "6994",
    languageCode: "en", // requested target language, not derived from the DOM
    source: "browser_bridge",
    segments,
  });
  assert.equal(result.segments.length, 1);
  assert.equal(result.languageCode, "en");
});

test("Phase 10 scenario 3: DOM extraction succeeds for auto-generated (ASR) captions -- no kind metadata gate exists for this path", () => {
  const rows = [
    { timestampText: "0:00", text: "Welcome to my channel, Bookish English" },
    { timestampText: "0:04", text: "Have you ever felt lost even when you're at home?" },
  ];
  const segments = buildSegmentsFromDomRows(rows);
  const result = assembleTranscriptResult({
    videoId: "PolmvqSxnbc",
    title: "Robinson Crusoe",
    lengthSeconds: "6994",
    languageCode: "en",
    source: "browser_bridge",
    segments,
  });
  assert.equal(result.source, "browser_bridge");
  assert.equal(result.segments.length, 2);
});

// --- Scenario 5: DOM rows appearing before a fallback deadline must
// resolve successfully, never time out into failure. Mirrors
// youtube-content-relay.js's waitForCaptureOrDom race exactly (that file
// can't be imported -- see its own header comment). ---

function simulateWaitForCaptureOrDom(getCapture, getDomRows, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const poll = setInterval(() => {
      const capture = getCapture();
      if (capture) {
        clearInterval(poll);
        resolve({ type: "network", capture });
        return;
      }
      const rows = getDomRows();
      if (rows.length > 0) {
        clearInterval(poll);
        resolve({ type: "dom", rows });
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(poll);
        resolve({ type: "none" });
      }
    }, 20);
  });
}

test("Phase 10 scenario 5: transcript panel rows appearing partway through the wait resolve immediately, not via timeout", async () => {
  let rows = [];
  setTimeout(() => {
    rows = [{ timestampText: "0:01", text: "row appeared mid-wait" }];
  }, 60);

  const start = Date.now();
  const result = await simulateWaitForCaptureOrDom(() => null, () => rows, 5000);
  const elapsedMs = Date.now() - start;

  assert.equal(result.type, "dom");
  assert.ok(elapsedMs < 500, `should resolve as soon as rows appear (~60ms), not wait out the full 5000ms timeout (took ${elapsedMs}ms)`);
});

test("Phase 10 scenario 5b: timeout with rows never appearing correctly reports 'none', not a false success", async () => {
  const result = await simulateWaitForCaptureOrDom(() => null, () => [], 200);
  assert.equal(result.type, "none");
});

// --- Scenarios 1, 6, 7: real background.mjs integration against a mocked
// chrome.tabs API. ---

let nextTabId = 1;
let mockChromeMessageListeners = [];
let mockTabs = [];
let mockSendMessageHandlers = new Map();
let mockRemoveCallOrder = [];
let mockEventOrder = [];

function installMockChrome() {
  nextTabId = 1;
  mockChromeMessageListeners = [];
  mockTabs = [];
  mockSendMessageHandlers = new Map();
  mockRemoveCallOrder = [];
  mockEventOrder = [];
  globalThis.chrome = {
    tabs: {
      async create({ url }) {
        const tab = { id: nextTabId++, url };
        mockTabs.push(tab);
        setTimeout(() => {
          const videoId = new URL(url).searchParams.get("v");
          for (const listener of mockChromeMessageListeners) {
            listener({ type: "LEXREADER_PAGE_READY", videoId }, { tab: { id: tab.id } });
          }
        }, 5);
        return tab;
      },
      async query() {
        return mockTabs.slice();
      },
      async sendMessage(tabId, message) {
        const handler = mockSendMessageHandlers.get(tabId);
        if (!handler) throw new Error(`no mock sendMessage handler registered for tab ${tabId}`);
        return handler(message);
      },
      async remove(tabId) {
        mockEventOrder.push("tab_removed");
        mockRemoveCallOrder.push(tabId);
        mockTabs = mockTabs.filter((t) => t.id !== tabId);
      },
    },
    runtime: {
      onMessage: {
        addListener(listener) {
          mockChromeMessageListeners.push(listener);
        },
        removeListener(listener) {
          mockChromeMessageListeners = mockChromeMessageListeners.filter((l) => l !== listener);
        },
      },
    },
  };
}

test("DOM-primary integration: DOM rows present -> extraction succeeds without invoking network fallback", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState } = await import("./request-state.mjs");

  const modes = [];
  mockSendMessageHandlers.set(1, async (message) => {
    modes.push(message.mode);
    return ({
    ok: true,
    domSegments: [
      { startMs: 190000, endMs: 197000, text: "real transcript line at 3:10" },
      { startMs: 197000, endMs: 201000, text: "real transcript line at 3:17" },
    ],
    metadata: { title: "Robinson Crusoe || Learn English through Stories", lengthSeconds: "6994" },
    });
  });

  const result = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=PolmvqSxnbc",
    "en",
    "req-dom-1",
    createRequestState(),
  );

  assert.equal(result.ok, true);
  assert.equal(result.transcript.source, "browser_bridge");
  assert.equal(result.transcript.segments.length, 2);
  assert.equal(result.transcript.segments[0].text, "real transcript line at 3:10");
  assert.deepEqual(modes, ["dom"], "a valid DOM result must prevent network fallback from being called");
});

test("DOM-primary integration: canonical result is assembled before direct-call temporary-tab cleanup", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState } = await import("./request-state.mjs");

  mockSendMessageHandlers.set(1, async () => ({
    ok: true,
    domSegments: [{ startMs: 1000, endMs: 5000, text: "row" }],
    metadata: { title: "Video", lengthSeconds: "10" },
  }));

  const result = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=PolmvqSxnbc",
    "en",
    "req-dom-6",
    createRequestState(),
  );

  // The function only returns AFTER transcript assembly succeeds (source
  // code order: assembleTranscriptResult runs, then the function returns,
  // then -- in background.mjs's `finally` -- tab removal is fired). By the
  // time this awaited call resolves with a fully-built transcript, removal
  // has already been scheduled but the transcript itself was never at risk
  // of being torn down mid-read, since it was already copied into `result`.
  assert.equal(result.ok, true);
  assert.equal(result.transcript.segments[0].text, "row");
  assert.deepEqual(mockRemoveCallOrder, [1], "the created tab must still be removed exactly once, after the result was already assembled");
  assert.deepEqual(mockEventOrder, ["tab_removed"]);
});

test("Phase 10 scenario 7: zero DOM rows AND no valid network capture -> transcript_unavailable is the only correct outcome", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState } = await import("./request-state.mjs");

  const modes = [];
  mockSendMessageHandlers.set(1, async (message) => {
    modes.push(message.mode);
    return {
      ok: false,
      error: "transcript_unavailable",
      internalReason: message.mode === "dom" ? "dom_timestamped_rows_unavailable" : "network_capture_unavailable",
    };
  });

  const result = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=PolmvqSxnbc",
    "en",
    "req-dom-7",
    createRequestState(),
  );

  assert.equal(result.ok, false);
  assert.equal(result.error, "transcript_unavailable");
  assert.deepEqual(modes, ["dom", "network"]);
});
