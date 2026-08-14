import { extractVideoId, buildTranscriptResult } from "./youtube-transcript.mjs";
import { createRequestState } from "./request-state.mjs";

// RC bridge-handshake bug (M3 Slice 12 RC): this set MUST stay identical to the
// ALLOWED_ORIGINS duplicate inside lexreader-bridge.js (a content script, which can't
// import this file — see the comment there for why). allowed-origins.test.mjs asserts
// both sets match on every run. This specific Preview deployment's unique per-deploy
// origin is added explicitly (not a *.vercel.app wildcard) for this RC's manual smoke
// test; every new Preview deploy needs its own explicit entry the same way — a real,
// known cost of exact-match allowlisting over a wildcard, accepted because it never
// trusts an origin the extension author didn't verify.
export const ALLOWED_APP_ORIGINS = new Set([
  "https://lexreader.vercel.app",
  "https://lexreader.app",
  "https://www.lexreader.app",
  "https://lexreader-focoqdkq7-meeeee4.vercel.app",
  "https://lexreader-mnzvtftfs-meeeee4.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const TAB_READY_TIMEOUT_MS = 12_000;
const EXTRACTION_TIMEOUT_MS = 18_000;
// Must stay >= TAB_READY_TIMEOUT_MS + EXTRACTION_TIMEOUT_MS (worst case:
// both sub-timeouts elapse sequentially) with headroom under the client's
// own 45s REQUEST_TIMEOUT_MS (youtube-import-form.tsx) for messaging overhead.
const OVERALL_TIMEOUT_MS = 38_000;

export function isAllowedSender(sender) {
  if (!sender?.url) return false;
  try {
    return ALLOWED_APP_ORIGINS.has(new URL(sender.url).origin);
  } catch {
    return false;
  }
}

// RC extraction bug (M3 Slice 12 RC): a video short enough that YouTube's own
// autoplay-next can fire before/during our extraction window (confirmed real,
// non-Playwright evidence: the exact recommended smoke-test video, 19s,
// auto-advanced to a different video within ~10-20s of load) silently swaps
// the tab's video context out from under us mid-extraction. The
// #lexreader-extraction marker is read by youtube-page-capture.js
// (document_start, MAIN world) to know this specific tab was created by us
// for extraction only -- never for a tab the user already had open and may
// be actually watching -- and to hold the video paused for the extraction
// window so it can never run to completion and autoplay away.
export function canonicalWatchUrl(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}#lexreader-extraction`;
}

export function withTimeout(promise, ms, onTimeoutError) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(onTimeoutError), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// Lifecycle bug (M3 Slice 12 RC #3): tabs we ourselves created for
// extraction are tracked here permanently (for the lifetime of this service
// worker instance) and are NEVER treated as a reusable "existing tab" for a
// later request, even if our own cleanup (chrome.tabs.remove in the
// `finally` below) somehow failed to run -- e.g. the service worker was
// torn down mid-extraction, a real MV3 risk since a bare setTimeout does
// not keep a service worker alive. Without this, a leaked extraction tab
// that YouTube's own autoplay-next has since navigated to some other video
// could be silently "reused" by a completely unrelated later request for
// that other video, handed to a stale content-script instance whose
// captures are scoped (see youtube-content-relay.js) to the ORIGINAL video
// the tab was created for -- silently breaking that later request.
const extractionTabIds = new Set();

async function findExistingTab(videoId) {
  const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/watch*", "https://youtube.com/watch*"] });
  return tabs.find((tab) => tab.url && extractVideoId(tab.url) === videoId && !extractionTabIds.has(tab.id)) ?? null;
}

/**
 * Waits for this specific tab's content script to announce itself ready.
 * Returns a promise with an attached `.cleanup()` so the caller can always
 * remove the onMessage listener, even on the timeout path -- lifecycle bug
 * (M3 Slice 12 RC #3): the old version only ever removed the listener
 * inside the success callback, so every tab-ready timeout leaked one
 * permanently-registered chrome.runtime.onMessage listener for the rest of
 * this service worker's lifetime.
 */
function waitForTabReady(tabId) {
  let listener;
  const promise = new Promise((resolve) => {
    listener = (message, sender) => {
      if (sender.tab?.id === tabId && message?.type === "LEXREADER_PAGE_READY") {
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
  promise.cleanup = () => chrome.runtime.onMessage.removeListener(listener);
  return promise;
}

async function extractFromTab(tabId, targetLanguage, requestId) {
  return await chrome.tabs.sendMessage(tabId, { type: "LEXREADER_EXTRACT_FROM_PAGE", targetLanguage, requestId });
}

function log(event, requestId, extra) {
  console.debug(`[LexReader:diag] ${event}`, { requestId, ...extra });
}

/**
 * Real extraction: finds or opens a real youtube.com tab (so the page's own
 * JS can generate a valid pot-authenticated caption request -- see
 * youtube-page-capture.js for why this can't be done with a bare fetch),
 * asks its content script to observe/trigger a real transcript capture,
 * and normalizes the result. Never invents data on failure.
 */
// Exported for lifecycle regression testing (Phase 10, M3 Slice 12 RC #3) --
// drives the real extraction flow end-to-end against a mocked chrome.tabs
// API so "first valid result wins" can be verified against the actual
// production code path, not just the abstract state machine in isolation.
export async function extractYoutubeTranscript(rawUrl, targetLanguage, requestId, requestState) {
  requestState.transition("waiting");
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    requestState.transition("failed");
    requestState.transition("cleaned");
    return { ok: false, error: "unsupported_video", message: "Не распознана ссылка на YouTube-видео." };
  }
  log("extraction started", requestId, { videoId, targetLanguage });

  const existingTab = await findExistingTab(videoId);
  let tabId = existingTab?.id ?? null;
  let createdTab = false;
  log("tab resolution", requestId, { videoId, tabId, reusedExisting: !!existingTab });

  try {
    if (tabId == null) {
      const tab = await chrome.tabs.create({ url: canonicalWatchUrl(videoId), active: true });
      tabId = tab.id;
      createdTab = true;
      extractionTabIds.add(tabId);
      log("tab created", requestId, { videoId, tabId });
      const readyPromise = waitForTabReady(tabId);
      try {
        await withTimeout(readyPromise, TAB_READY_TIMEOUT_MS, new Error("youtube_tab_timeout"));
        log("tab ready reached", requestId, { videoId, tabId, ready: true });
      } catch (readyError) {
        log("tab ready reached", requestId, { videoId, tabId, ready: false });
        throw readyError;
      } finally {
        readyPromise.cleanup();
      }
    }

    const response = await withTimeout(
      extractFromTab(tabId, targetLanguage, requestId),
      EXTRACTION_TIMEOUT_MS,
      new Error("extraction_failed"),
    );
    log("extraction response", requestId, {
      videoId,
      tabId,
      ok: !!response?.ok,
      error: response?.ok ? null : (response?.error ?? "extraction_failed"),
      internalReason: response?.internalReason ?? null,
      segmentSourceLang: response?.capture?.lang ?? null,
      segmentSourceKind: response?.capture?.kind ?? null,
    });

    if (!response?.ok) {
      requestState.transition("failed");
      return { ok: false, error: response?.error ?? "extraction_failed", message: "Не удалось получить субтитры этого видео." };
    }

    requestState.transition("captured");
    const transcript = buildTranscriptResult({
      videoId,
      title: response.metadata?.title,
      lengthSeconds: response.metadata?.lengthSeconds,
      lang: response.capture.lang,
      kind: response.capture.kind,
      bodyText: response.capture.bodyText,
    });
    log("parsed transcript", requestId, { videoId, segmentCount: transcript.segments.length });

    requestState.transition("resolved");
    return { ok: true, transcript };
  } catch (error) {
    // Never surface raw internal error text to the caller (§8/§11) -- map
    // to one of a small set of known, safe error codes. youtube_tab_timeout
    // is an internal-only distinction (RC extraction bug, Phase 8) folded
    // into youtube_page_not_open at the boundary -- the UI copy is the same
    // either way, but the two are logged distinctly above.
    const code = error instanceof Error ? error.message : "extraction_failed";
    const externalCode = code === "youtube_tab_timeout" ? "youtube_page_not_open" : code;
    const knownCodes = new Set(["youtube_page_not_open", "extraction_failed", "transcript_unavailable"]);
    const finalCode = knownCodes.has(externalCode) ? externalCode : "extraction_failed";
    log("extraction failed", requestId, { videoId, tabId, internalCode: code, finalCode });
    requestState.transition("failed");
    return {
      ok: false,
      error: finalCode,
      message: "Не удалось получить субтитры этого видео.",
    };
  } finally {
    // Lifecycle bug (M3 Slice 12 RC #3), Phase 4: capture is already copied
    // into `transcript`/the response object above BEFORE this runs, so tab
    // teardown can never race a still-in-flight read of the captured data --
    // only the tab itself (no longer needed either way) is torn down here.
    if (createdTab && tabId != null) {
      chrome.tabs.remove(tabId).catch(() => {});
    }
    requestState.transition("cleaned");
    log("request cleaned", requestId, { videoId, tabId });
  }
}

// Lifecycle bug (M3 Slice 12 RC #3): one entry per in-flight/recently-settled
// request, purely to make "first valid result wins" an explicit, logged
// guarantee at this layer too (chrome.runtime's own sendResponse already
// only honors the first call per message natively -- this is the same
// invariant, made visible and testable rather than only incidentally true).
const requestStates = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LEXREADER_YOUTUBE_BRIDGE_PING") {
    sendResponse({ ok: isAllowedSender(sender) });
    return false;
  }

  if (
    message?.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST" ||
    !isAllowedSender(sender)
  ) {
    return false;
  }

  const requestId = typeof message.requestId === "string" ? message.requestId : `unlabeled-${Date.now()}`;
  const requestState = createRequestState();
  requestStates.set(requestId, requestState);
  log("request received", requestId, {});

  const timeoutFallback = { ok: false, error: "extraction_failed", message: "Извлечение субтитров заняло слишком много времени." };
  withTimeout(extractYoutubeTranscript(message.url, message.targetLanguage, requestId, requestState), OVERALL_TIMEOUT_MS, timeoutFallback)
    .then((result) => {
      sendResponse(result);
    })
    .catch((reason) => {
      // The inner extraction promise never actually rejects on its own
      // paths (extractYoutubeTranscript always returns, never throws past
      // its own try/catch) -- this catch only fires for OVERALL_TIMEOUT_MS's
      // own timeout, which the inner call's `requestState` never sees, so
      // mark it failed here explicitly (a no-op if the inner call already
      // reached a terminal state first -- first valid result still wins).
      requestState.transition("waiting");
      requestState.transition("failed");
      requestState.transition("cleaned");
      log("overall timeout", requestId, {});
      sendResponse(reason?.ok === false ? reason : timeoutFallback);
    })
    .finally(() => {
      requestStates.delete(requestId);
    });

  return true;
});
