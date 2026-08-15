import { extractVideoId, buildTranscriptResult, assembleTranscriptResult } from "./youtube-transcript.mjs";
import { createRequestState } from "./request-state.mjs";

// Exact-match allowlist. allowed-origins.test.mjs keeps this synchronized
// with lexreader-bridge.js and manifest.json; broad *.vercel.app trust is
// intentionally forbidden.
export const ALLOWED_APP_ORIGINS = new Set([
  "https://lexreader.vercel.app",
  "https://lexreader.app",
  "https://www.lexreader.app",
  "https://lexreader-focoqdkq7-meeeee4.vercel.app",
  "https://lexreader-mnzvtftfs-meeeee4.vercel.app",
  "https://lexreader-ctoczfjdx-meeeee4.vercel.app",
  "https://lexreader-1zg3zf2nv-meeeee4.vercel.app",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const TAB_READY_TIMEOUT_MS = 15_000;
// This is the one global safety ceiling. Normal DOM collection is governed
// by scroll/row progress and stable exhaustion, never by a 10-20 second race.
export const EMERGENCY_TIMEOUT_MS = 90_000;

export function isAllowedSender(sender) {
  if (!sender?.url) return false;
  try {
    return ALLOWED_APP_ORIGINS.has(new URL(sender.url).origin);
  } catch {
    return false;
  }
}

export function canonicalWatchUrl(videoId, { domOnly = false } = {}) {
  const marker = domOnly ? "lexreader-extraction-dom-only" : "lexreader-extraction";
  return `https://www.youtube.com/watch?v=${videoId}&autoplay=0#${marker}`;
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

function log(event, requestId, extra = {}) {
  console.debug(`[LexReader:diag] ${event}`, { requestId, ...extra });
}

function waitForTabReady(tabId, videoId) {
  let listener;
  const promise = new Promise((resolve) => {
    listener = (message, sender) => {
      if (
        sender.tab?.id === tabId &&
        message?.type === "LEXREADER_PAGE_READY" &&
        message.videoId === videoId
      ) {
        resolve();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
  promise.cleanup = () => chrome.runtime.onMessage.removeListener(listener);
  return promise;
}

async function sendAcquisitionCommand(tabId, { requestId, videoId, targetLanguage, mode }) {
  return await chrome.tabs.sendMessage(tabId, {
    type: "LEXREADER_EXTRACT_FROM_PAGE",
    requestId,
    videoId,
    targetLanguage,
    mode,
  });
}

function isClosedMessageChannel(error) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /message channel closed|receiving end does not exist|could not establish connection/i.test(message);
}

function shortDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForExactRelay(tabId, videoId, requestState, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !requestState.isTerminal) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "LEXREADER_PAGE_RELAY_PING" });
      if (response?.ok && response.videoId === videoId) return true;
    } catch {
      // A replacement document may exist before its isolated content script
      // has loaded. Retry only within this bounded reload-recovery window.
    }
    await shortDelay(200);
  }
  return false;
}

async function sendDomCommandWithReloadRecovery(
  tabId,
  command,
  requestState,
  onReload,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await sendAcquisitionCommand(tabId, command);
    } catch (error) {
      if (!isClosedMessageChannel(error) || attempt === 2 || requestState.isTerminal) throw error;
      await onReload(attempt + 1);
      const ready = await waitForExactRelay(tabId, command.videoId, requestState);
      if (!ready) throw error;
    }
  }
  throw new Error("youtube_relay_unavailable");
}

async function cancelAcquisition(tabId, requestId) {
  if (tabId == null) return;
  await chrome.tabs.sendMessage(tabId, { type: "LEXREADER_CANCEL_EXTRACTION", requestId }).catch(() => {});
}

function shouldRetryColdDomPage(response) {
  return (
    response?.internalReason === "dom_panel_or_rows_unavailable" &&
    response?.diagnostics?.metadataAvailable === false &&
    response?.diagnostics?.watchMetadataPresent === false
  );
}

function safeFailure(error = "extraction_failed", message = "Не удалось получить субтитры этого видео.", diagnostics) {
  return { ok: false, error, message, ...(diagnostics ? { diagnostics } : {}) };
}

function mapInternalError(error) {
  const code = error instanceof Error ? error.message : "extraction_failed";
  if (code === "youtube_tab_timeout") return "youtube_page_not_open";
  if (code === "emergency_timeout") return "extraction_failed";
  return new Set(["youtube_page_not_open", "extraction_failed", "transcript_unavailable"]).has(code)
    ? code
    : "extraction_failed";
}

function assembleDomTranscript(videoId, targetLanguage, response) {
  return assembleTranscriptResult({
    videoId,
    title: response.metadata?.title,
    lengthSeconds: response.metadata?.lengthSeconds,
    languageCode: targetLanguage,
    source: "browser_bridge",
    segments: response.domSegments,
  });
}

function assembleNetworkTranscript(videoId, response) {
  return buildTranscriptResult({
    videoId,
    title: response.metadata?.title,
    lengthSeconds: response.metadata?.lengthSeconds,
    lang: response.capture.lang,
    kind: response.capture.kind,
    bodyText: response.capture.bodyText,
  });
}

// requestId -> { youtubeTabId, originTabId, videoId }. Progress from a
// YouTube tab is forwarded only when every identifier matches this exact
// active request. A late observer from request A therefore cannot update the
// progress UI for request B, even if a tab id were ever reused by Chrome.
const requestContexts = new Map();

async function forwardProgress(originTabId, requestId, stage, details = {}) {
  if (originTabId == null) return;
  await chrome.tabs.sendMessage(originTabId, {
    type: "LEXREADER_EXTRACTION_PROGRESS",
    requestId,
    stage,
    details,
  }).catch(() => {});
}

/**
 * Owns the complete lifecycle for one logical import and delivers exactly one
 * terminal payload. `deliver` runs before temporary-tab removal; Chrome has
 * copied the response toward the LexReader content script before cleanup can
 * tear down the YouTube page.
 */
export async function extractYoutubeTranscript(
  rawUrl,
  targetLanguage,
  requestId,
  requestState,
  {
    domOnly = false,
    originTabId = null,
    deliver = () => {},
    emergencyTimeoutMs = EMERGENCY_TIMEOUT_MS,
  } = {},
) {
  const videoId = extractVideoId(rawUrl);
  let tabId = null;
  let terminalResult = null;
  let emergencyReject;
  const emergency = new Promise((_, reject) => {
    emergencyReject = reject;
  });

  async function progress(stage, details = {}) {
    log("progress", requestId, { videoId, stage, ...details });
    await forwardProgress(originTabId, requestId, stage, details);
  }

  async function extractionFlow() {
    if (!videoId) {
      requestState.settleFailure();
      return safeFailure("unsupported_video", "Не распознана ссылка на YouTube-видео.");
    }

    requestState.transition("opening_video");
    await progress("opening_video");
    const tab = await chrome.tabs.create({ url: canonicalWatchUrl(videoId, { domOnly }), active: true });
    tabId = tab.id;
    requestContexts.set(requestId, { youtubeTabId: tabId, originTabId, videoId });
    log("temporary tab created", requestId, { videoId, tabId, domOnly });

    const readyPromise = waitForTabReady(tabId, videoId);
    try {
      await withTimeout(readyPromise, TAB_READY_TIMEOUT_MS, new Error("youtube_tab_timeout"));
    } finally {
      readyPromise.cleanup();
    }

    requestState.transition("opening_transcript");
    await progress("opening_transcript");
    requestState.transition("dom_collecting");
    const domCommand = { requestId, videoId, targetLanguage, mode: "dom" };
    let domResponse = await sendDomCommandWithReloadRecovery(
      tabId,
      domCommand,
      requestState,
      async (reloadAttempt) => {
        log("same-video relay reload detected", requestId, { videoId, tabId, reloadAttempt });
        await progress("opening_transcript", { reloadAttempt });
      },
    );

    if (shouldRetryColdDomPage(domResponse)) {
      requestState.transition("dom_retrying");
      await progress("opening_video", { coldPageRetry: 1 });
      const retryReady = waitForTabReady(tabId, videoId);
      try {
        await chrome.tabs.update(tabId, { url: canonicalWatchUrl(videoId, { domOnly }), active: true });
        await withTimeout(retryReady, TAB_READY_TIMEOUT_MS, new Error("youtube_tab_timeout"));
      } finally {
        retryReady.cleanup();
      }
      requestState.transition("opening_transcript");
      await progress("opening_transcript", { coldPageRetry: 1 });
      requestState.transition("dom_collecting");
      domResponse = await sendDomCommandWithReloadRecovery(
        tabId,
        domCommand,
        requestState,
        async (reloadAttempt) => {
          log("same-video relay reload detected after cold-page retry", requestId, {
            videoId,
            tabId,
            reloadAttempt,
          });
          await progress("opening_transcript", { coldPageRetry: 1, reloadAttempt });
        },
      );
    }
    log("DOM acquisition returned", requestId, {
      videoId,
      tabId,
      ok: Boolean(domResponse?.ok),
      reason: domResponse?.internalReason ?? null,
      diagnostics: domResponse?.diagnostics ?? null,
    });

    if (domResponse?.ok) {
      const transcript = assembleDomTranscript(videoId, targetLanguage, domResponse);
      if (!requestState.settleSuccess()) throw new Error("stale_dom_success");
      await progress("ready", { acquisitionSource: "dom", uniqueSegments: transcript.segments.length });
      return { ok: true, transcript, diagnostics: domResponse.diagnostics };
    }

    requestState.transition("dom_failed");
    if (domOnly) {
      requestState.settleFailure();
      return safeFailure(
        "transcript_unavailable",
        "DOM-only extraction could not obtain a complete transcript.",
        domResponse?.diagnostics,
      );
    }

    requestState.transition("network_fallback");
    await progress("network_fallback", { domReason: domResponse?.internalReason ?? "unknown" });
    const networkResponse = await sendAcquisitionCommand(tabId, {
      requestId,
      videoId,
      targetLanguage,
      mode: "network",
    });
    log("network fallback returned", requestId, {
      videoId,
      tabId,
      ok: Boolean(networkResponse?.ok),
      reason: networkResponse?.internalReason ?? null,
    });

    if (networkResponse?.ok) {
      const transcript = assembleNetworkTranscript(videoId, networkResponse);
      if (!requestState.settleSuccess()) throw new Error("stale_network_success");
      await progress("ready", { acquisitionSource: "network", uniqueSegments: transcript.segments.length });
      return { ok: true, transcript, diagnostics: networkResponse.diagnostics };
    }

    requestState.settleFailure();
    return safeFailure("transcript_unavailable", "У этого видео нет доступных субтитров.", domResponse?.diagnostics);
  }

  requestState.startEmergencyTimer(emergencyTimeoutMs, () => {
    log("emergency ceiling reached", requestId, { videoId, tabId, emergencyTimeoutMs });
    void cancelAcquisition(tabId, requestId);
    emergencyReject(new Error("emergency_timeout"));
  });

  try {
    terminalResult = await Promise.race([extractionFlow(), emergency]);
  } catch (error) {
    const finalCode = mapInternalError(error);
    requestState.settleFailure();
    terminalResult = safeFailure(
      finalCode,
      finalCode === "extraction_failed"
        ? "Извлечение субтитров заняло слишком много времени."
        : "Не удалось получить субтитры этого видео.",
    );
    log("extraction failed", requestId, {
      videoId,
      tabId,
      internalCode: error instanceof Error ? error.message : "unknown",
      finalCode,
    });
  }

  try {
    // Mandatory ordering: assembled terminal payload -> delivery toward
    // LexReader -> only then close the temporary YouTube tab.
    await deliver(terminalResult);
    log("terminal payload delivered toward LexReader", requestId, {
      videoId,
      tabId,
      ok: terminalResult.ok,
      acquisitionSource: terminalResult.diagnostics?.acquisitionSource ?? null,
    });
  } finally {
    requestState.cancelEmergency();
    if (tabId != null) await chrome.tabs.remove(tabId).catch(() => {});
    requestContexts.delete(requestId);
    requestState.transition("cleaned");
    log("request cleaned", requestId, { videoId, tabId, finalState: requestState.state });
  }

  return terminalResult;
}

const requestStates = new Map();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "LEXREADER_YOUTUBE_BRIDGE_PING") {
    sendResponse({ ok: isAllowedSender(sender) });
    return false;
  }

  if (message?.type === "LEXREADER_EXTRACTION_PROGRESS") {
    const context = requestContexts.get(message.requestId);
    if (
      !context ||
      sender.tab?.id !== context.youtubeTabId ||
      message.videoId !== context.videoId
    ) return false;
    void forwardProgress(context.originTabId, message.requestId, message.stage, message.details);
    return false;
  }

  if (message?.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST" || !isAllowedSender(sender)) {
    return false;
  }

  const requestId = typeof message.requestId === "string" ? message.requestId : `unlabeled-${Date.now()}`;
  if (requestStates.has(requestId)) {
    sendResponse(safeFailure("extraction_failed", "Этот запрос уже выполняется."));
    return false;
  }

  const requestState = createRequestState();
  requestStates.set(requestId, requestState);
  log("request received", requestId, { originTabId: sender.tab?.id ?? null, domOnly: message.domOnly === true });

  extractYoutubeTranscript(message.url, message.targetLanguage, requestId, requestState, {
    domOnly: message.domOnly === true,
    originTabId: sender.tab?.id ?? null,
    deliver: (result) => sendResponse(result),
  }).finally(() => {
    requestStates.delete(requestId);
  });

  return true;
});
