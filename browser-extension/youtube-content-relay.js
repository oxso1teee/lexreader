// Isolated-world YouTube content script. The background service worker owns
// the single request lifecycle and calls this script in two explicit phases:
//
//   1. DOM primary: open the native transcript UI, collect every virtualized
//      timestamped row, normalize it, and prove completeness.
//   2. Network secondary: only after DOM failed, read an already-observed
//      pot-authenticated timedtext response (if one exists).
//
// There is no DOM/network race in this file. A DOM success leaves through one
// response channel and the background never invokes phase 2 afterward.
(() => {
  "use strict";

  const domExtractor = globalThis.LexReaderYoutubeDomExtractor;
  if (!domExtractor) {
    console.error("[LexReader:diag] DOM extractor was not loaded before content relay");
    return;
  }

  function currentVideoId() {
    try {
      return new URL(location.href).searchParams.get("v");
    } catch {
      return null;
    }
  }

  const expectedVideoId = currentVideoId();
  const captures = new Map();
  const captureWaiters = new Set();
  const activeCommands = new Map();
  let metadata = null;

  function log(event, requestId, extra = {}) {
    console.debug(`[LexReader:diag] ${event}`, { requestId, videoId: expectedVideoId, ...extra });
  }

  function sendProgress(requestId, stage, details = {}) {
    if (!requestId) return;
    chrome.runtime.sendMessage({
      type: "LEXREADER_EXTRACTION_PROGRESS",
      requestId,
      videoId: expectedVideoId,
      stage,
      details,
    }).catch(() => {});
  }

  function findCapture(targetLanguage) {
    const target = String(targetLanguage ?? "").toLowerCase();
    const baseTarget = target.split("-")[0];
    for (const capture of captures.values()) {
      const lang = String(capture.lang ?? "").toLowerCase();
      if (lang === target || lang.split("-")[0] === baseTarget) return capture;
    }
    return captures.values().next().value ?? null;
  }

  function notifyCaptureWaiters() {
    for (const waiter of [...captureWaiters]) waiter();
  }

  console.debug("[LexReader:diag] capture listener attached", { videoId: expectedVideoId });
  document.addEventListener("lexreader:transcript-captured", (event) => {
    const detail = event.detail;
    if (!detail) return;
    if (detail.type === "metadata") {
      if (expectedVideoId && detail.videoId && detail.videoId !== expectedVideoId) return;
      metadata = detail;
      notifyCaptureWaiters();
      return;
    }
    if (detail.type !== "timedtext" || !detail.bodyText) return;
    if (expectedVideoId && detail.videoId && detail.videoId !== expectedVideoId) {
      log("capture rejected (wrong video)", null, { capturedVideoId: detail.videoId });
      return;
    }
    const key = `${detail.lang ?? ""}|${detail.kind ?? ""}`;
    captures.set(key, detail);
    log("capture stored", null, {
      lang: detail.lang,
      kind: detail.kind,
      bodyLength: detail.bodyText.length,
      totalCaptures: captures.size,
    });
    notifyCaptureWaiters();
  });

  function abortError() {
    const error = new Error("extraction_cancelled");
    error.name = "AbortError";
    return error;
  }

  function throwIfAborted(signal) {
    if (signal?.aborted) throw abortError();
  }

  function waitForExpectedDomState(predicate, { root, signal, idleMs = 2_500 } = {}) {
    throwIfAborted(signal);
    const immediate = predicate();
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve, reject) => {
      let settled = false;
      let idleTimer = null;
      const finish = (value, error) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(idleTimer);
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve(value);
      };
      const check = () => {
        const value = predicate();
        if (value) finish(value);
      };
      const resetIdle = () => {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => finish(null), idleMs);
      };
      const onAbort = () => finish(null, abortError());
      const observer = new MutationObserver(() => {
        check();
        if (!settled) resetIdle();
      });
      // This content script intentionally starts at document_start. On a
      // cold navigation `document.body` may still be null, while Document is
      // already a valid observable Node.
      observer.observe(root ?? document.body ?? document.documentElement ?? document, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      resetIdle();
      check();
    });
  }

  function validMountedRows() {
    return domExtractor
      .readMountedRows(document)
      .filter((row) => domExtractor.parseRow(row));
  }

  function transcriptRowsPresent() {
    return validMountedRows().length > 0;
  }

  function normalizedControlText(element) {
    return domExtractor.cleanText(
      [element?.getAttribute?.("aria-label"), element?.getAttribute?.("title"), element?.textContent]
        .filter(Boolean)
        .join(" "),
    ).toLowerCase();
  }

  function isCloseControl(element) {
    const text = normalizedControlText(element);
    return /\bclose\b|закрыть|скрыть/.test(text);
  }

  function isLocalizedTranscriptControl(element) {
    if (!element || isCloseControl(element)) return false;
    const text = normalizedControlText(element);
    return (
      text.includes("show transcript") ||
      text.includes("video transcript") ||
      text === "transcript" ||
      text.includes("показать текст видео") ||
      text.includes("показать расшифровку") ||
      text.includes("расшифровка видео") ||
      text === "расшифровка" ||
      text.includes("текст видео")
    );
  }

  function interactiveElements(root = document) {
    return [...root.querySelectorAll("button, [role='button'], tp-yt-paper-button, ytd-menu-service-item-renderer")];
  }

  function findPrimaryTranscriptControl() {
    const structuralSelectors = [
      "ytd-video-description-transcript-section-renderer button",
      "ytd-video-description-transcript-section-renderer [role='button']",
      "ytd-video-description-transcript-section-renderer",
      "button[aria-label*='transcript' i]",
    ];
    for (const selector of structuralSelectors) {
      const element = document.querySelector(selector);
      if (element && !isCloseControl(element)) return element;
    }
    return interactiveElements().find(isLocalizedTranscriptControl) ?? null;
  }

  function findSecondTranscriptControl() {
    const candidateRoots = [
      domExtractor.findPanelRoot(document),
      ...document.querySelectorAll(
        "ytd-engagement-panel-section-list-renderer[visibility='ENGAGEMENT_PANEL_VISIBILITY_EXPANDED'], ytd-engagement-panel-section-list-renderer[target-id*='macro-markers']",
      ),
    ].filter(Boolean);
    for (const root of candidateRoots) {
      const structural = root.querySelector(
        "button[aria-label*='transcript' i], [role='button'][aria-label*='transcript' i]",
      );
      if (structural && !isCloseControl(structural)) return structural;
      const localized = interactiveElements(root).find(isLocalizedTranscriptControl);
      if (localized) return localized;
    }
    return interactiveElements().find((element) => {
      const text = normalizedControlText(element);
      return text.includes("video transcript") || text.includes("расшифровка видео");
    }) ?? null;
  }

  function findTranscriptMenuItem() {
    const items = [...document.querySelectorAll("ytd-menu-service-item-renderer, tp-yt-paper-item, [role='menuitem']")];
    return items.find((item) => {
      const structural =
        item.querySelector("[target-id*='transcript'], [aria-label*='transcript' i]") ||
        String(item.innerHTML ?? "").includes("engagement-panel-searchable-transcript") ||
        String(item.innerHTML ?? "").includes("getTranscriptEndpoint");
      return Boolean(structural) || isLocalizedTranscriptControl(item);
    }) ?? null;
  }

  function findMoreActionsControl() {
    const selectors = [
      "button[aria-label='More actions']",
      "button[aria-label*='More actions' i]",
      "button[aria-label='Ещё']",
      "button[aria-label*='Другие действия' i]",
      "ytd-menu-renderer button",
    ];
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function watchMetadataReady() {
    return document.querySelector(
      "ytd-watch-metadata #description, #description-inline-expander, ytd-video-description-transcript-section-renderer, ytd-watch-flexy #below",
    );
  }

  async function clickAndWait(element, predicate, signal, idleMs = 2_500) {
    if (!element) return null;
    element.click();
    return await waitForExpectedDomState(predicate, {
      root: document.querySelector("#panels") ?? document.querySelector("#below") ?? document.body,
      signal,
      idleMs,
    });
  }

  async function openNativeTranscriptUi(signal, requestId) {
    if (transcriptRowsPresent()) return domExtractor.findPanelRoot(document);

    // document_idle means the initial HTML was parsed, not that YouTube's
    // Polymer/Lit watch metadata has hydrated. Waiting for this structural
    // boundary prevents the former two-second false negative where neither
    // the description nor overflow actions existed yet.
    await waitForExpectedDomState(
      () => transcriptRowsPresent() || findPrimaryTranscriptControl() || watchMetadataReady(),
      { root: document.body, signal, idleMs: 12_000 },
    );
    if (transcriptRowsPresent()) return domExtractor.findPanelRoot(document);

    const expand = document.querySelector(
      "ytd-text-inline-expander button#expand, #description-inline-expander #expand, tp-yt-paper-button#expand",
    );
    if (expand) {
      await clickAndWait(
        expand,
        () => findPrimaryTranscriptControl() || transcriptRowsPresent(),
        signal,
        8_000,
      );
    }

    if (!findPrimaryTranscriptControl() && !transcriptRowsPresent()) {
      await waitForExpectedDomState(
        () => transcriptRowsPresent() || findPrimaryTranscriptControl() || findMoreActionsControl(),
        { root: document.querySelector("#below") ?? document.body, signal, idleMs: 6_000 },
      );
    }

    const primary = findPrimaryTranscriptControl();
    log("primary transcript control", requestId, {
      found: Boolean(primary),
      label: primary ? normalizedControlText(primary).slice(0, 120) : null,
    });
    if (primary) {
      await clickAndWait(
        primary,
        () => transcriptRowsPresent() || findSecondTranscriptControl(),
        signal,
        10_000,
      );
    }
    if (transcriptRowsPresent()) return domExtractor.findPanelRoot(document);

    const second = findSecondTranscriptControl();
    log("secondary transcript control", requestId, {
      found: Boolean(second),
      label: second ? normalizedControlText(second).slice(0, 120) : null,
    });
    if (second) {
      // Multi-track videos can leave a real spinner in this panel for well
      // over ten seconds. MutationObserver still resolves immediately when
      // timestamp rows arrive; 30s is only a no-progress idle boundary.
      await clickAndWait(second, transcriptRowsPresent, signal, 30_000);
    }
    if (transcriptRowsPresent()) return domExtractor.findPanelRoot(document);

    // Older YouTube variants expose Show transcript only in the overflow
    // menu. This is a structural/semantic fallback after the description
    // and engagement-panel paths, not a localized-text primary selector.
    const more = findMoreActionsControl();
    if (more) {
      await clickAndWait(more, findTranscriptMenuItem, signal, 2_500);
      const menuItem = findTranscriptMenuItem();
      if (menuItem) await clickAndWait(menuItem, transcriptRowsPresent, signal, 30_000);
    }

    if (transcriptRowsPresent()) return domExtractor.findPanelRoot(document);
    return null;
  }

  async function waitForTimestampedRows(signal) {
    const immediate = validMountedRows();
    if (immediate.length > 0) return immediate;
    const root =
      domExtractor.findPanelRoot(document) ??
      document.querySelector("#panels") ??
      document.querySelector("#below") ??
      document.body;
    return await waitForExpectedDomState(
      () => {
        const rows = validMountedRows();
        return rows.length > 0 ? rows : null;
      },
      { root, signal, idleMs: 8_000 },
    );
  }

  function videoDurationMs() {
    const metadataDuration = Number(metadata?.lengthSeconds) * 1_000;
    if (Number.isFinite(metadataDuration) && metadataDuration > 0) return Math.round(metadataDuration);
    const elementDuration = Number(document.querySelector("video")?.duration) * 1_000;
    return Number.isFinite(elementDuration) && elementDuration > 0 ? Math.round(elementDuration) : undefined;
  }

  function domPageDiagnostics(extra = {}) {
    return {
      acquisitionSource: "dom",
      videoId: expectedVideoId,
      durationMs: videoDurationMs() ?? null,
      metadataAvailable: Boolean(metadata),
      watchMetadataPresent: Boolean(document.querySelector("ytd-watch-metadata")),
      ...extra,
    };
  }

  async function extractDomTranscript(requestId, signal) {
    document.querySelector("video")?.pause();
    sendProgress(requestId, "opening_transcript");
    const panel = await openNativeTranscriptUi(signal, requestId);
    if (!panel) {
      return {
        ok: false,
        error: "transcript_unavailable",
        internalReason: "dom_panel_or_rows_unavailable",
        diagnostics: domPageDiagnostics(),
      };
    }

    sendProgress(requestId, "reading_transcript");
    const rows = await waitForTimestampedRows(signal);
    if (!rows?.length) {
      return {
        ok: false,
        error: "transcript_unavailable",
        internalReason: "dom_timestamped_rows_unavailable",
        diagnostics: domPageDiagnostics(),
      };
    }

    sendProgress(requestId, "collecting_segments", { uniqueSegments: rows.length });
    const durationMs = videoDurationMs();
    let lastProgressAt = 0;
    const collected = await domExtractor.collectFromDocument(document, {
      durationMs,
      signal,
      onProgress(progress) {
        const now = Date.now();
        if (now - lastProgressAt < 500 && !progress.retrying) return;
        lastProgressAt = now;
        sendProgress(requestId, "collecting_segments", progress);
      },
    });

    const diagnostics = domPageDiagnostics({
      ...collected.metrics,
    });
    log("DOM collection complete", requestId, diagnostics);
    if (!collected.metrics.completeness.complete) {
      return {
        ok: false,
        error: "transcript_unavailable",
        internalReason: `dom_incomplete:${collected.metrics.completeness.reason}`,
        diagnostics,
      };
    }
    return { ok: true, domSegments: collected.segments, metadata, diagnostics };
  }

  function waitForNetworkCapture(targetLanguage, signal, idleMs = 15_000) {
    throwIfAborted(signal);
    const immediate = findCapture(targetLanguage);
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve, reject) => {
      let timer;
      const finish = (value, error) => {
        captureWaiters.delete(check);
        signal?.removeEventListener("abort", onAbort);
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value);
      };
      const check = () => {
        const capture = findCapture(targetLanguage);
        if (capture) finish(capture);
      };
      const onAbort = () => finish(null, abortError());
      captureWaiters.add(check);
      signal?.addEventListener("abort", onAbort, { once: true });
      timer = setTimeout(() => finish(null), idleMs);
      check();
    });
  }

  async function extractNetworkFallback(targetLanguage, requestId, signal) {
    sendProgress(requestId, "network_fallback");
    const capture = await waitForNetworkCapture(targetLanguage, signal);
    if (!capture) {
      return { ok: false, error: "transcript_unavailable", internalReason: "network_capture_unavailable" };
    }
    log("network fallback captured", requestId, {
      lang: capture.lang,
      kind: capture.kind,
      bodyLength: capture.bodyText?.length ?? 0,
    });
    return {
      ok: true,
      capture: { lang: capture.lang, kind: capture.kind, bodyText: capture.bodyText },
      metadata,
      diagnostics: {
        acquisitionSource: "network",
        videoId: expectedVideoId,
        durationMs: videoDurationMs() ?? null,
      },
    };
  }

  async function executeCommand(message, signal) {
    if (!message.requestId || message.videoId !== expectedVideoId || currentVideoId() !== expectedVideoId) {
      return { ok: false, error: "transcript_unavailable", internalReason: "video_context_mismatch" };
    }
    if (message.mode === "dom") return await extractDomTranscript(message.requestId, signal);
    if (message.mode === "network") return await extractNetworkFallback(message.targetLanguage, message.requestId, signal);
    return { ok: false, error: "extraction_failed", internalReason: "unknown_acquisition_mode" };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "LEXREADER_PAGE_RELAY_PING") {
      sendResponse({ ok: true, videoId: expectedVideoId });
      return false;
    }
    if (message?.type === "LEXREADER_CANCEL_EXTRACTION") {
      for (const [key, controller] of activeCommands) {
        if (key.startsWith(`${message.requestId}|`)) controller.abort();
      }
      sendResponse({ ok: true });
      return false;
    }
    if (message?.type !== "LEXREADER_EXTRACT_FROM_PAGE") return false;

    const key = `${message.requestId}|${message.mode}`;
    const controller = new AbortController();
    activeCommands.set(key, controller);
    log("acquisition command received", message.requestId, { mode: message.mode });

    executeCommand(message, controller.signal)
      .then((result) => {
        log("acquisition response sent to background", message.requestId, {
          mode: message.mode,
          ok: result.ok,
          reason: result.internalReason ?? null,
        });
        sendResponse(result);
      })
      .catch((error) => {
        const aborted = error?.name === "AbortError";
        log("acquisition command failed", message.requestId, {
          mode: message.mode,
          name: error?.name ?? "Error",
          message: error?.message ?? "unknown",
          stack: String(error?.stack ?? "").slice(0, 1_000),
        });
        sendResponse({
          ok: false,
          error: aborted ? "extraction_failed" : "transcript_unavailable",
          internalReason: aborted ? "request_cancelled" : "dom_extractor_exception",
          diagnostics: aborted ? undefined : {
            acquisitionSource: "dom",
            exception: error?.message ?? "unknown",
          },
        });
      })
      .finally(() => {
        if (activeCommands.get(key) === controller) activeCommands.delete(key);
      });
    return true;
  });

  log("page relay ready", null, {});
  chrome.runtime.sendMessage({ type: "LEXREADER_PAGE_READY", videoId: expectedVideoId }).catch(() => {});
})();
