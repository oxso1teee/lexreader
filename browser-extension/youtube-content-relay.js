// Isolated-world content script on youtube.com. Bridges the MAIN-world
// page-capture script (real page JS, no chrome.* access) to the background
// service worker (chrome.* access, no direct page JS access) -- the
// standard two-world pattern for MV3 extensions that need both. Never
// fetches anything itself; only observes CustomEvents the MAIN-world
// script dispatches and relays chrome.runtime messages.
// captures/findCapture below mirror capture-store.mjs's createCaptureStore()
// algorithm exactly; waitForCapture below mirrors wait-for-value.mjs's
// waitForValue() exactly; buildSegmentsFromDomRows/parseTimestampToMs below
// mirror dom-transcript.mjs exactly. All three are tested there in
// isolation -- this file can't literally import any of them (MV3 content
// scripts declared via manifest.json's content_scripts[].js don't support
// "type": "module"). Keep every pair in sync by hand.
//
// Lifecycle bug (M3 Slice 12 RC #3) -- real-browser network evidence proved
// YouTube's own autoplay/up-next machinery fires genuine
// /api/timedtext?fmt=json3 requests for a DIFFERENT, unrelated video while
// this exact tab is still open on the video being extracted. MV3 content
// scripts are NOT reinjected on YouTube's own soft/SPA navigations, so if
// YouTube later navigates this same tab to a different video (autoplay-
// next), THIS SAME script instance keeps running with the SAME module-level
// state. Defenses: `expectedVideoId` captured once at boot, every capture
// rejected unless it matches; every extraction request carries a
// `requestId`, and once a request reaches a terminal state (resolved or
// failed) nothing can move it to a different terminal state.
//
// Lifecycle bug (M3 Slice 12 RC #4) -- real user evidence (ordinary Chrome,
// unpacked extension) proved the transcript panel can visibly render a
// real, complete transcript while LexReader still returns
// transcript_unavailable. Root-caused two real, independent factors: (1)
// YouTube's current UI opens a combined "В этом видео" (chapters/overview)
// panel on the first click -- reaching the actual full transcript view
// requires a SECOND click on that panel's own "Расшифровка видео" control,
// which the old code never performed; (2) a real captured ASR timedtext
// body can be well over 1MB (confirmed: 1.45MB for a 116-minute video,
// 1.2s just to read the body in a fast test environment), which can
// plausibly exceed the old fixed 8s fallback wait on a real user's
// connection even when the network capture path is otherwise completely
// healthy. Fixes: perform the second click when that sub-button exists;
// extend the wait budget substantially; and add a DOM-read fallback so
// that a transcript panel with real visible rows is NEVER reported as
// transcript_unavailable merely because our own network interception
// hasn't (yet, or ever) produced a capture.
(() => {
  function currentVideoId() {
    try {
      return new URL(location.href).searchParams.get("v");
    } catch {
      return null;
    }
  }

  const expectedVideoId = currentVideoId();
  const captures = new Map(); // key: `${lang}|${kind}` -> {videoId, lang, kind, bodyText}
  let metadata = null;

  // Per-request state machine: idle -> waiting -> captured -> resolved -> cleaned
  //                                          \-> failed -> cleaned
  // `resolved` and `failed` are both terminal; no transition out of either.
  let activeRequestId = null;
  let activeState = "idle";

  function log(event, requestId, extra) {
    console.debug(`[LexReader:diag] ${event}`, { requestId, videoId: expectedVideoId, ...extra });
  }

  console.debug("[LexReader:diag] capture listener attached", { videoId: expectedVideoId });
  document.addEventListener("lexreader:transcript-captured", (event) => {
    const detail = event.detail;
    if (!detail) return;
    if (detail.type === "metadata") {
      metadata = detail;
      return;
    }
    if (detail.type === "timedtext") {
      if (expectedVideoId && detail.videoId && detail.videoId !== expectedVideoId) {
        // Real, observed YouTube behavior: a capture for a video other than
        // the one this tab/request is for (autoplay-next prefetch, or a
        // late SPA navigation). Never store it -- never let it satisfy or
        // corrupt this request's result.
        console.debug("[LexReader:diag] capture rejected (wrong video)", {
          expectedVideoId,
          capturedVideoId: detail.videoId,
          lang: detail.lang,
          kind: detail.kind,
        });
        return;
      }
      const key = `${detail.lang ?? ""}|${detail.kind ?? ""}`;
      captures.set(key, detail);
      console.debug("[LexReader:diag] capture stored", {
        videoId: expectedVideoId,
        lang: detail.lang,
        kind: detail.kind,
        bodyLength: detail.bodyText?.length ?? 0,
        totalCaptures: captures.size,
      });
    }
  });

  function findCapture(targetLanguage) {
    const target = String(targetLanguage ?? "").toLowerCase();
    const baseTarget = target.split("-")[0];
    for (const capture of captures.values()) {
      const lang = String(capture.lang ?? "").toLowerCase();
      if (lang === target || lang.split("-")[0] === baseTarget) return capture;
    }
    // No exact match -- fall back to whatever was captured first (the
    // video's own default track), never invent data. Since every entry in
    // `captures` is already video-scoped, this can never fall back into an
    // unrelated video's data.
    return captures.values().next().value ?? null;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // RC extraction bug (M3 Slice 12 RC) -- real testing (a genuine, non-Playwright
  // browser, real trusted clicks) found the real "show transcript" control
  // (aria-label "Показать текст видео") lives inside the video's description
  // panel, which is COLLAPSED by default -- the description's own "...ещё"
  // expander must be clicked first.
  //
  // Lifecycle bug (M3 Slice 12 RC #4) -- real testing on the CURRENT YouTube
  // UI found that click alone now opens a combined "В этом видео" overview
  // panel (chapters + short excerpts), not the full per-segment transcript
  // view. Reaching the real, complete transcript requires a SECOND click on
  // that panel's own internal "Расшифровка видео" button, when present
  // (older UI variants open the real transcript panel directly on the first
  // click and never render this second button -- clicking it is
  // conditional, never assumed).
  async function clickTranscriptButton() {
    const expandBtn = document.querySelector(
      "tp-yt-paper-button#expand, ytd-text-inline-expander button#expand, #description-inline-expander #expand",
    );
    if (expandBtn) {
      expandBtn.click();
      await sleep(400); // let the description panel finish expanding before searching it
    }

    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find((el) => {
      const label = (el.getAttribute("aria-label") || "").toLowerCase();
      return (
        (label.includes("transcript") || label.includes("показать текст")) &&
        !label.includes("close") &&
        !label.includes("закр")
      );
    });
    if (!button) return false;
    button.click();
    await sleep(600); // let the panel render before looking for the sub-button

    const subButton = [...document.querySelectorAll("button")].find((el) => {
      const label = (el.getAttribute("aria-label") || "").toLowerCase();
      return label.includes("расшифровка видео") && !label.includes("закр");
    });
    if (subButton) {
      subButton.click();
    }
    return true;
  }

  // Lifecycle bug (M3 Slice 12 RC #4) -- DOM extraction fallback. Real,
  // verified selectors against YouTube's current transcript panel:
  // <transcript-segment-view-model> rows with a
  // .ytwTranscriptSegmentViewModelTimestamp timestamp div and the segment
  // text in a role="text" span. ytd-transcript-segment-renderer (older
  // Polymer UI) is queried too, defensively, in case that variant is still
  // served to some sessions -- never assumed, just attempted.
  function readTranscriptPanelRows() {
    const rows = document.querySelectorAll("transcript-segment-view-model, ytd-transcript-segment-renderer");
    const extracted = [];
    for (const row of rows) {
      const timestampEl = row.querySelector(
        ".ytwTranscriptSegmentViewModelTimestamp, .segment-timestamp, #timestamp",
      );
      const textEl = row.querySelector('span[role="text"], .segment-text, yt-formatted-string.segment-text');
      if (!timestampEl || !textEl) continue;
      extracted.push({ timestampText: timestampEl.textContent, text: textEl.textContent });
    }
    return extracted;
  }

  // Mirrors dom-transcript.mjs's parseTimestampToMs exactly.
  function parseTimestampToMs(text) {
    if (typeof text !== "string") return null;
    const trimmed = text.trim();
    if (!/^\d{1,2}(:\d{2}){1,2}$/.test(trimmed)) return null;
    const parts = trimmed.split(":").map(Number);
    if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
    const seconds = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
    return Math.round(seconds * 1000);
  }

  // Mirrors dom-transcript.mjs's buildSegmentsFromDomRows exactly.
  function buildSegmentsFromDomRows(rows) {
    const LAST_SEGMENT_EXTENSION_MS = 4000;
    const parsed = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const startMs = parseTimestampToMs(row?.timestampText);
      const text = String(row?.text ?? "").replace(/\s+/g, " ").trim();
      if (startMs == null || !text) continue;
      parsed.push({ startMs, text });
    }
    return parsed.map((segment, index) => {
      const nextStart = parsed[index + 1]?.startMs;
      const endMs =
        nextStart != null && nextStart > segment.startMs ? nextStart : segment.startMs + LAST_SEGMENT_EXTENSION_MS;
      return { startMs: segment.startMs, endMs, text: segment.text };
    });
  }

  /**
   * Lifecycle bug (M3 Slice 12 RC #4), Phase 3: races a real network
   * capture against DOM rows appearing, over the full window -- whichever
   * arrives first is used. If the window elapses with neither, one final
   * DOM check is made before giving up (covers a capture/DOM row landing
   * right at the boundary). This is what makes "never report
   * transcript_unavailable while the panel has visible rows" literally
   * true: a DOM row appearing at any point during the poll immediately
   * resolves the wait.
   */
  function waitForCaptureOrDom(targetLanguage, timeoutMs, requestId) {
    const immediateCapture = findCapture(targetLanguage);
    if (immediateCapture) return Promise.resolve({ type: "network", capture: immediateCapture });
    const immediateRows = readTranscriptPanelRows();
    if (immediateRows.length > 0) return Promise.resolve({ type: "dom", rows: immediateRows });

    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        if (requestId !== activeRequestId || activeState === "resolved" || activeState === "failed") {
          clearInterval(poll);
          resolve({ type: "abandoned" });
          return;
        }
        const capture = findCapture(targetLanguage);
        if (capture) {
          clearInterval(poll);
          resolve({ type: "network", capture });
          return;
        }
        const rows = readTranscriptPanelRows();
        if (rows.length > 0) {
          clearInterval(poll);
          resolve({ type: "dom", rows });
          return;
        }
        if (Date.now() >= deadline) {
          clearInterval(poll);
          // One last look at both signals right at the boundary.
          const lastCapture = findCapture(targetLanguage);
          if (lastCapture) {
            resolve({ type: "network", capture: lastCapture });
            return;
          }
          const lastRows = readTranscriptPanelRows();
          resolve(lastRows.length > 0 ? { type: "dom", rows: lastRows } : { type: "none" });
        }
      }, 200);
    });
  }

  async function extractTranscript(targetLanguage, requestId) {
    activeRequestId = requestId;
    activeState = "waiting";
    log("extraction requested", requestId, { targetLanguage });

    // The video's own default caption track is usually already captured
    // automatically within a couple seconds of page load (real, proven
    // behavior -- no click needed). Give that a short window first.
    let result = await waitForCaptureOrDom(targetLanguage, 4000, requestId);
    log("default-track wait result", requestId, {
      resultType: result.type,
      lang: result.capture?.lang ?? null,
      kind: result.capture?.kind ?? null,
      domRowCount: result.rows?.length ?? null,
    });

    if (requestId !== activeRequestId) {
      log("request superseded, abandoning", requestId, { stage: "after-default-wait" });
      return { ok: false, error: "transcript_unavailable", internalReason: "request_superseded" };
    }

    const capturedLangMatches =
      result.type === "network" &&
      String(result.capture.lang ?? "").toLowerCase().split("-")[0] === String(targetLanguage ?? "").toLowerCase().split("-")[0];

    if (result.type === "none" || (result.type === "network" && !capturedLangMatches)) {
      // Either nothing captured yet, or only a non-matching-language network
      // capture -- opening the real transcript panel (both clicks, Phase 2)
      // makes YouTube's own code issue a fresh, correctly-authenticated
      // request our MAIN-world observer will catch, and/or renders real DOM
      // rows we can read directly.
      const clicked = await clickTranscriptButton();
      log("transcript-panel button clicked", requestId, { clicked });
      // Lifecycle bug (M3 Slice 12 RC #4): extended from 8s -- a real
      // captured ASR body can exceed 1MB and take multiple seconds to
      // fetch+read on a real connection; this window must comfortably
      // cover that, not just a fast test environment.
      const retried = await waitForCaptureOrDom(targetLanguage, 22000, requestId);
      log("panel-fallback wait result", requestId, {
        resultType: retried.type,
        lang: retried.capture?.lang ?? null,
        kind: retried.capture?.kind ?? null,
        domRowCount: retried.rows?.length ?? null,
      });
      if (retried.type !== "none" && retried.type !== "abandoned") result = retried;
    }

    if (requestId !== activeRequestId) {
      log("request superseded, abandoning", requestId, { stage: "after-panel-fallback" });
      return { ok: false, error: "transcript_unavailable", internalReason: "request_superseded" };
    }

    if (result.type === "dom") {
      const segments = buildSegmentsFromDomRows(result.rows);
      if (segments.length === 0) {
        // Rows existed but none parsed cleanly (Phase 4/5 defensiveness) --
        // fall through to the "nothing usable" failure path below rather
        // than reporting a false success.
        result = { type: "none" };
      } else {
        activeState = "resolved";
        log("extraction result: ok (dom)", requestId, { segmentCount: segments.length });
        return { ok: true, domSegments: segments, metadata };
      }
    }

    if (result.type === "network") {
      activeState = "resolved";
      log("extraction result: ok (network)", requestId, {
        lang: result.capture.lang,
        kind: result.capture.kind,
        bodyLength: result.capture.bodyText?.length ?? 0,
      });
      return {
        ok: true,
        capture: { lang: result.capture.lang, kind: result.capture.kind, bodyText: result.capture.bodyText },
        metadata,
      };
    }

    // findCapture() always falls back to "whatever was captured first" when
    // captures.size > 0 (never invents data, but prefers partial reality
    // over nothing), and the DOM path is checked independently above -- so
    // reaching this branch means genuinely NEITHER a network capture NOR a
    // single rendered transcript row was ever observed for this video. This
    // is what makes "no subtitles for this video" an honest statement
    // (Phase 11): if either acquisition path had produced anything, this
    // function would already have returned success above.
    activeState = "failed";
    log("extraction result: failed", requestId, { reason: "timedtext_not_observed" });
    return { ok: false, error: "transcript_unavailable", internalReason: "timedtext_not_observed" };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "LEXREADER_EXTRACT_FROM_PAGE") return false;
    const requestId = typeof message.requestId === "string" ? message.requestId : null;
    log("extraction message received", requestId, {});
    extractTranscript(message.targetLanguage, requestId).then((result) => {
      if (requestId === activeRequestId) activeState = "cleaned";
      log("request cleaned", requestId, { ok: result.ok });
      log("response sent to background", requestId, { ok: result.ok });
      sendResponse(result);
    });
    return true; // keep the message channel open for the async response
  });

  // Tell the background service worker this tab is ready to receive
  // extraction requests (it may have just been created for this purpose).
  console.debug("[LexReader:diag] page relay ready, announcing to background", { videoId: expectedVideoId });
  chrome.runtime.sendMessage({ type: "LEXREADER_PAGE_READY" }).catch(() => {});
})();
