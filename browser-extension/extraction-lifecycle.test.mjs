// Real background.mjs integration against a mocked Chrome tabs API. These
// tests exercise the production lifecycle owner directly: terminal result
// isolation, same-target document reload recovery, one cold-page retry, and
// sequential imports without an extension reload.
import test from "node:test";
import assert from "node:assert/strict";
import { createRequestState } from "./request-state.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("Phase 10 scenario 6 (cross-reference): duplicate terminal signals for one request -- see request-state.test.mjs for the exhaustive state-machine coverage; spot-checked here too", () => {
  const state = createRequestState();
  state.transition("opening_video");
  state.transition("opening_transcript");
  state.transition("dom_collecting");
  assert.equal(state.settleSuccess(), true);
  assert.equal(state.settleFailure(), false, "a late failure must not be able to flip an already-resolved request");
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
let mockUpdateCalls = [];

function installMockChrome() {
  nextTabId = 1;
  mockChromeMessageListeners = [];
  mockTabs = [];
  mockSendMessageHandlers = new Map();
  mockUpdateCalls = [];
  globalThis.chrome = {
    tabs: {
      async create({ url }) {
        const tab = { id: nextTabId++, url };
        mockTabs.push(tab);
        // Real content script announces readiness almost immediately --
        // simulate that by firing LEXREADER_PAGE_READY shortly after
        // creation, same as the real extension's youtube-content-relay.js.
        setTimeout(() => {
          const videoId = new URL(tab.url).searchParams.get("v");
          for (const listener of mockChromeMessageListeners) {
            listener({ type: "LEXREADER_PAGE_READY", videoId }, { tab: { id: tab.id } });
          }
        }, 5);
        return tab;
      },
      async query() {
        return mockTabs.slice();
      },
      async update(tabId, changes) {
        const tab = mockTabs.find((candidate) => candidate.id === tabId);
        if (!tab) throw new Error(`unknown mock tab ${tabId}`);
        if (changes.url) tab.url = changes.url;
        mockUpdateCalls.push({ tabId, changes });
        setTimeout(() => {
          const videoId = new URL(tab.url).searchParams.get("v");
          for (const listener of mockChromeMessageListeners) {
            listener({ type: "LEXREADER_PAGE_READY", videoId }, { tab: { id: tab.id } });
          }
        }, 5);
        return tab;
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

  const modesA = [];
  mockSendMessageHandlers.set(1, async (message) => {
    modesA.push(message.mode);
    return { ok: false, error: "transcript_unavailable", internalReason: `${message.mode}_unavailable` };
  });
  const resultA = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=videoA",
    "en",
    "req-A",
    freshState(),
  );
  assert.equal(resultA.ok, false);
  assert.deepEqual(modesA, ["dom", "network"]);

  const modesB = [];
  mockSendMessageHandlers.set(2, async (message) => {
    modesB.push(message.mode);
    return {
      ok: true,
      domSegments: [{ startMs: 0, endMs: 1_000, text: "hello" }],
      metadata: { title: "Video B", lengthSeconds: "10" },
      diagnostics: { acquisitionSource: "dom" },
    };
  });
  const resultB = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=videoB",
    "en",
    "req-B",
    freshState(),
  );
  assert.equal(resultB.ok, true);
  assert.equal(resultB.transcript.videoId, "videoB");
  assert.deepEqual(modesB, ["dom"], "DOM success must prevent the network fallback from starting");
});

test("Phase 10 scenario 7: an old request's result arriving after a newer request has already started must not overwrite the newer request's state", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState: freshState } = await import("./request-state.mjs");

  // Old request (tab 1, videoOld): its content-script response is slow.
  mockSendMessageHandlers.set(1, () => new Promise((resolve) => {
    setTimeout(() => resolve({ ok: true, domSegments: [{ startMs: 0, endMs: 1_000, text: "stale old data" }], metadata: { title: "Old", lengthSeconds: "5" }, diagnostics: { acquisitionSource: "dom" } }), 60);
  }));
  // New request (tab 2, videoNew): resolves fast.
  mockSendMessageHandlers.set(2, async () => ({ ok: true, domSegments: [{ startMs: 0, endMs: 1_000, text: "fresh new data" }], metadata: { title: "New", lengthSeconds: "5" }, diagnostics: { acquisitionSource: "dom" } }));

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

test("same-target document reload resumes DOM collection in the original lifecycle", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState: freshState } = await import("./request-state.mjs");
  const messages = [];
  let domAttempts = 0;

  mockSendMessageHandlers.set(1, async (message) => {
    messages.push(message.type === "LEXREADER_PAGE_RELAY_PING" ? "ping" : message.mode);
    if (message.type === "LEXREADER_PAGE_RELAY_PING") {
      return { ok: true, videoId: "videoReloaded" };
    }
    domAttempts += 1;
    if (domAttempts === 1) {
      throw new Error("A listener indicated an asynchronous response but the message channel closed before a response was received");
    }
    return {
      ok: true,
      domSegments: [{ startMs: 0, endMs: 4_000, text: "survived reload" }],
      metadata: { title: "Reloaded", lengthSeconds: "4" },
      diagnostics: { acquisitionSource: "dom" },
    };
  });

  const state = freshState();
  const result = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=videoReloaded",
    "en",
    "req-reload",
    state,
  );

  assert.equal(result.ok, true);
  assert.equal(result.transcript.segments[0].text, "survived reload");
  assert.deepEqual(messages, ["dom", "ping", "dom"]);
  assert.equal(state.state, "cleaned");
});

test("a cold unhydrated YouTube document gets one exact-video DOM retry", async () => {
  installMockChrome();
  const { extractYoutubeTranscript } = await import("./background.mjs");
  const { createRequestState: freshState } = await import("./request-state.mjs");
  let domAttempts = 0;

  mockSendMessageHandlers.set(1, async (message) => {
    if (message.mode !== "dom") throw new Error(`unexpected mode ${message.mode}`);
    domAttempts += 1;
    if (domAttempts === 1) {
      return {
        ok: false,
        error: "transcript_unavailable",
        internalReason: "dom_panel_or_rows_unavailable",
        diagnostics: { metadataAvailable: false, watchMetadataPresent: false },
      };
    }
    return {
      ok: true,
      domSegments: [{ startMs: 0, endMs: 4_000, text: "hydrated after retry" }],
      metadata: { title: "Hydrated", lengthSeconds: "4" },
      diagnostics: { acquisitionSource: "dom" },
    };
  });

  const state = freshState();
  const result = await extractYoutubeTranscript(
    "https://www.youtube.com/watch?v=coldVideo",
    "en",
    "req-cold",
    state,
  );

  assert.equal(result.ok, true);
  assert.equal(domAttempts, 2);
  assert.equal(mockUpdateCalls.length, 1);
  assert.match(mockUpdateCalls[0].changes.url, /v=coldVideo/);
  assert.equal(result.transcript.segments[0].text, "hydrated after retry");
  assert.equal(state.state, "cleaned");
});
