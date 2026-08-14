import { extractVideoId, buildTranscriptResult } from "./youtube-transcript.mjs";

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

async function findExistingTab(videoId) {
  const tabs = await chrome.tabs.query({ url: ["https://www.youtube.com/watch*", "https://youtube.com/watch*"] });
  return tabs.find((tab) => tab.url && extractVideoId(tab.url) === videoId) ?? null;
}

/** Waits for this specific tab's content script to announce itself ready. */
function waitForTabReady(tabId) {
  return new Promise((resolve) => {
    function listener(message, sender) {
      if (sender.tab?.id === tabId && message?.type === "LEXREADER_PAGE_READY") {
        chrome.runtime.onMessage.removeListener(listener);
        resolve();
      }
    }
    chrome.runtime.onMessage.addListener(listener);
  });
}

async function extractFromTab(tabId, targetLanguage) {
  return await chrome.tabs.sendMessage(tabId, { type: "LEXREADER_EXTRACT_FROM_PAGE", targetLanguage });
}

/**
 * Real extraction: finds or opens a real youtube.com tab (so the page's own
 * JS can generate a valid pot-authenticated caption request -- see
 * youtube-page-capture.js for why this can't be done with a bare fetch),
 * asks its content script to observe/trigger a real transcript capture,
 * and normalizes the result. Never invents data on failure.
 */
async function extractYoutubeTranscript(rawUrl, targetLanguage) {
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    return { ok: false, error: "unsupported_video", message: "Не распознана ссылка на YouTube-видео." };
  }
  console.debug("[LexReader:diag] extraction started", { videoId, targetLanguage });

  const existingTab = await findExistingTab(videoId);
  let tabId = existingTab?.id ?? null;
  let createdTab = false;
  console.debug("[LexReader:diag] tab resolution", { videoId, tabId, reusedExisting: !!existingTab });

  try {
    if (tabId == null) {
      const tab = await chrome.tabs.create({ url: canonicalWatchUrl(videoId), active: true });
      tabId = tab.id;
      createdTab = true;
      console.debug("[LexReader:diag] tab created", { videoId, tabId });
      try {
        await withTimeout(waitForTabReady(tabId), TAB_READY_TIMEOUT_MS, new Error("youtube_tab_timeout"));
        console.debug("[LexReader:diag] tab ready reached", { videoId, tabId, ready: true });
      } catch (readyError) {
        console.debug("[LexReader:diag] tab ready reached", { videoId, tabId, ready: false });
        throw readyError;
      }
    }

    const response = await withTimeout(
      extractFromTab(tabId, targetLanguage),
      EXTRACTION_TIMEOUT_MS,
      new Error("extraction_failed"),
    );
    console.debug("[LexReader:diag] extraction response", {
      videoId,
      tabId,
      ok: !!response?.ok,
      error: response?.ok ? null : (response?.error ?? "extraction_failed"),
      segmentSourceLang: response?.capture?.lang ?? null,
      segmentSourceKind: response?.capture?.kind ?? null,
    });

    if (!response?.ok) {
      return { ok: false, error: response?.error ?? "extraction_failed", message: "Не удалось получить субтитры этого видео." };
    }

    const transcript = buildTranscriptResult({
      videoId,
      title: response.metadata?.title,
      lengthSeconds: response.metadata?.lengthSeconds,
      lang: response.capture.lang,
      kind: response.capture.kind,
      bodyText: response.capture.bodyText,
    });
    console.debug("[LexReader:diag] parsed transcript", { videoId, segmentCount: transcript.segments.length });

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
    console.debug("[LexReader:diag] extraction failed", { videoId, tabId, internalCode: code, finalCode });
    return {
      ok: false,
      error: finalCode,
      message: "Не удалось получить субтитры этого видео.",
    };
  } finally {
    if (createdTab && tabId != null) {
      chrome.tabs.remove(tabId).catch(() => {});
    }
  }
}

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

  const timeoutFallback = { ok: false, error: "extraction_failed", message: "Извлечение субтитров заняло слишком много времени." };
  withTimeout(extractYoutubeTranscript(message.url, message.targetLanguage), OVERALL_TIMEOUT_MS, timeoutFallback)
    .then((result) => sendResponse(result))
    .catch((reason) => sendResponse(reason?.ok === false ? reason : timeoutFallback));

  return true;
});
