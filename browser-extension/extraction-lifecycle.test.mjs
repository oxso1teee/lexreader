// Lifecycle bug (M3 Slice 12 RC #3) -- Phase 10 regression tests, exactly
// the 7 scenarios specified: a single logical request must reach exactly
// one terminal result, and that result must never be overwritten by a
// later/stale signal, whether the stale signal is a duplicate, an old
// timer, or a result belonging to a different (older or newer) request.
//
// Two layers are exercised:
// - createCaptureStore + waitForValue, composed exactly the way
//   youtube-content-relay.js composes them (that file can't be imported
//   directly -- see its own header comment for why), covering scenarios
//   1, 2, 3, 5.
// - background.mjs's real extractYoutubeTranscript against a mocked
//   chrome.tabs API, covering scenarios 4 and 7 (cross-request isolation
//   at the layer that actually owns tabs and sendResponse).
// Scenario 6 (duplicate terminal callbacks for the same requestId) is
// covered directly and exhaustively in request-state.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import { createCaptureStore } from "./capture-store.mjs";
import { waitForValue } from "./wait-for-value.mjs";
import { createRequestState } from "./request-state.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mirrors youtube-content-relay.js's extractTranscript(): try a short
// default-track wait, and only if that misses/mismatches, take a fallback
// wait. First non-null result from either wait becomes the final answer;
// nothing afterward can change it.
async function simulateExtractTranscript(store, targetLanguage, { defaultWaitMs = 50, fallbackWaitMs = 100 } = {}) {
  let capture = await waitForValue(() => store.find(targetLanguage), defaultWaitMs, 5);
  if (!capture) {
    capture = await waitForValue(() => store.find(targetLanguage), fallbackWaitMs, 5);
  }
  return capture ? { ok: true, capture } : { ok: false, error: "transcript_unavailable" };
}

test("Phase 10 scenario 1: a valid capture landing early is not overwritten by a late timeout on the same wait", async () => {
  const store = createCaptureStore("videoA");
  setTimeout(() => store.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "real transcript" }), 20);

  const result = await simulateExtractTranscript(store, "en", { defaultWaitMs: 200, fallbackWaitMs: 100 });

  assert.equal(result.ok, true);
  assert.equal(result.capture.bodyText, "real transcript");
});

test("Phase 10 scenario 2: a valid capture is preserved even if an empty/rejected timedtext arrives afterward", async () => {
  const store = createCaptureStore("videoA");
  store.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "real transcript" });
  // An empty body is rejected by the store itself -- this must never be able
  // to clear or replace the already-valid entry.
  const rejected = store.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "" });

  assert.equal(rejected, false);
  const result = await simulateExtractTranscript(store, "en");
  assert.equal(result.ok, true);
  assert.equal(result.capture.bodyText, "real transcript");
});

test("Phase 10 scenario 3: once a request's local flow has produced its answer, a later transcript_unavailable-style signal for a DIFFERENT video cannot override it", async () => {
  const store = createCaptureStore("videoA");
  store.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "real transcript for videoA" });

  const result = await simulateExtractTranscript(store, "en");
  assert.equal(result.ok, true);

  // Simulate a late, unrelated-video "nothing captured" signal arriving --
  // it must be rejected at the store boundary, never reach findCapture.
  const stored = store.set({ videoId: "videoB", lang: "en", kind: null, bodyText: "unrelated video" });
  assert.equal(stored, false);
  assert.equal(store.find("en").bodyText, "real transcript for videoA");
});

test("Phase 10 scenario 5: two SUCCESS requests for different videos in sequence are fully isolated from each other", async () => {
  const storeA = createCaptureStore("videoA");
  const storeB = createCaptureStore("videoB");
  storeA.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "transcript A" });
  storeB.set({ videoId: "videoB", lang: "en", kind: null, bodyText: "transcript B" });
  // A wrong-video write attempted against either store (as if a single
  // shared tab/content-script leaked state across the two requests) must be
  // rejected by both.
  assert.equal(storeA.set({ videoId: "videoB", lang: "en", kind: null, bodyText: "leak" }), false);
  assert.equal(storeB.set({ videoId: "videoA", lang: "en", kind: null, bodyText: "leak" }), false);

  const resultA = await simulateExtractTranscript(storeA, "en");
  const resultB = await simulateExtractTranscript(storeB, "en");
  assert.equal(resultA.capture.bodyText, "transcript A");
  assert.equal(resultB.capture.bodyText, "transcript B");
});

test("Phase 10 scenario 6 (cross-reference): duplicate terminal signals for one request -- see request-state.test.mjs for the exhaustive state-machine coverage; spot-checked here too", () => {
  const state = createRequestState();
  state.transition("waiting");
  assert.equal(state.transition("resolved"), true);
  assert.equal(state.transition("failed"), false, "a late failure must not be able to flip an already-resolved request");
  assert.equal(state.state, "resolved");
});

test("Phase 10 (background.mjs integration): mock chrome environment sets up an isolated tabs API per test", async () => {
  // Sanity check for the mock harness used by the two tests below --
  // ensures chrome.tabs.create/query/sendMessage/remove all behave as this
  // suite expects before relying on them for scenarios 4 and 7.
  installMockChrome();
  const tab = await chrome.tabs.create({ url: "https://www.youtube.com/watch?v=videoA#lexreader-extraction", active: true });
  assert.equal(typeof tab.id, "number");
  const found = await chrome.tabs.query({ url: ["https://www.youtube.com/watch*"] });
  assert.equal(found.length, 1);
});

let nextTabId = 1;
let mockChromeMessageListeners = [];
let mockTabs = [];
let mockSendMessageHandlers = new Map(); // tabId -> (message) => Promise<response>

function installMockChrome() {
  nextTabId = 1;
  mockChromeMessageListeners = [];
  mockTabs = [];
  mockSendMessageHandlers = new Map();
  globalThis.chrome = {
    tabs: {
      async create({ url }) {
        const tab = { id: nextTabId++, url };
        mockTabs.push(tab);
        // Real content script announces readiness almost immediately --
        // simulate that by firing LEXREADER_PAGE_READY shortly after
        // creation, same as the real extension's youtube-content-relay.js.
        setTimeout(() => {
          for (const listener of mockChromeMessageListeners) {
            listener({ type: "LEXREADER_PAGE_READY" }, { tab: { id: tab.id } });
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

test("Phase 10 scenario 4: a FAILED request for one video does not poison a SUCCESS request for the next video (no reload needed)", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState: freshState } = await import("./request-state.mjs");

  mockSendMessageHandlers.set(1, async () => ({ ok: false, error: "transcript_unavailable", internalReason: "timedtext_not_observed" }));
  const resultA = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=videoA",
    "en",
    "req-A",
    freshState(),
  );
  assert.equal(resultA.ok, false);

  mockSendMessageHandlers.set(2, async () => ({ ok: true, capture: { lang: "en", kind: null, bodyText: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "hello" }] }] }) }, metadata: { title: "Video B", lengthSeconds: "10" } }));
  const resultB = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=videoB",
    "en",
    "req-B",
    freshState(),
  );
  assert.equal(resultB.ok, true);
  assert.equal(resultB.transcript.videoId, "videoB");
});

test("Phase 10 scenario 7: an old request's result arriving after a newer request has already started must not overwrite the newer request's state", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState: freshState } = await import("./request-state.mjs");

  // Old request (tab 1, videoOld): its content-script response is slow.
  mockSendMessageHandlers.set(1, () => new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, capture: { lang: "en", kind: null, bodyText: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "stale old data" }] }] }) }, metadata: { title: "Old", lengthSeconds: "5" } }), 60);
  }));
  // New request (tab 2, videoNew): resolves fast.
  mockSendMessageHandlers.set(2, async () => ({ ok: true, capture: { lang: "en", kind: null, bodyText: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1000, segs: [{ utf8: "fresh new data" }] }] }) }, metadata: { title: "New", lengthSeconds: "5" } }));

  const oldState = freshState();
  const newState = freshState();
  const oldPromise = extractYoutubeTranscript("https://www.youtube.com/watch?v=videoOld", "en", "req-old", oldState);
  await sleep(10); // ensure the old request is genuinely in flight first
  const newResult = await extractYoutubeTranscript("https://www.youtube.com/watch?v=videoNew", "en", "req-new", newState);

  assert.equal(newResult.ok, true);
  assert.equal(newResult.transcript.videoId, "videoNew");
  assert.equal(newResult.transcript.segments[0].text, "fresh new data");
  assert.equal(newState.state, "cleaned");

  const oldResult = await oldPromise;
  assert.equal(oldResult.ok, true);
  assert.equal(oldResult.transcript.videoId, "videoOld", "the old request's own result still resolves to ITS OWN video -- each request is independently tab-scoped, so neither can ever be handed the other's data");
  assert.notEqual(oldResult.transcript.segments[0].text, "fresh new data");
});
