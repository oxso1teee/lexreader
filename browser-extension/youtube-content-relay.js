// Isolated-world content script on youtube.com. Bridges the MAIN-world
// page-capture script (real page JS, no chrome.* access) to the background
// service worker (chrome.* access, no direct page JS access) -- the
// standard two-world pattern for MV3 extensions that need both. Never
// fetches anything itself; only observes CustomEvents the MAIN-world
// script dispatches and relays chrome.runtime messages.
// captures/findCapture below mirror capture-store.mjs's createCaptureStore()
// algorithm exactly; waitForCapture below mirrors wait-for-value.mjs's
// waitForValue() exactly. Both are tested there in isolation -- this file
// can't literally import either (MV3 content scripts declared via
// manifest.json's content_scripts[].js don't support "type": "module").
// Keep both pairs in sync by hand.
//
// Lifecycle bug (M3 Slice 12 RC #3) -- real-browser network evidence proved
// YouTube's own autoplay/up-next machinery fires genuine
// /api/timedtext?fmt=json3 requests for a DIFFERENT, unrelated video while
// this exact tab is still open on the video being extracted (observed: a
// request for a wholly different videoId landed ~300ms after our own
// video's request, before any navigation happened on this tab). MV3
// content scripts are NOT reinjected on YouTube's own soft/SPA
// navigations (pushState, no new document load), so if YouTube later
// navigates this same tab to a different video (autoplay-next), THIS SAME
// script instance keeps running with the SAME module-level state. Two
// defenses against that:
// 1. `expectedVideoId` is captured once, from this tab's URL, the moment
//    this script boots (before any navigation) -- every capture is
//    rejected unless it matches, so a later autoplay-next video can never
//    contaminate the request for the video this tab was opened for.
// 2. Every extraction request carries a `requestId`; once a request
//    reaches a terminal state (resolved or failed), nothing can move it
//    to a different terminal state. "First valid result wins."
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
  // browser, real trusted clicks) found two separate problems with the old
  // one-shot "find a button whose aria-label matches, click it" approach:
  // 1. The real "show transcript" control (aria-label "Показать текст видео")
  //    lives inside the video's description panel, which is COLLAPSED by
  //    default -- it's in the DOM but not visible/attached until the
  //    description's own "...ещё" ("...more") expander is clicked first.
  // 2. The old Russian guesses "расшифров"/"стенограм" (Gate #2C) turn out to
  //    match a completely unrelated filter chip ("Расшифровка видео" inside a
  //    chip-bar-view-model) that happens to share the substring but does
  //    nothing useful when clicked -- a false-positive match, not a timing
  //    issue. Matching "показать текст" instead is verified against the real
  //    DOM structure (ytd-video-description-transcript-section-renderer).
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
    if (button) {
      button.click();
      return true;
    }
    return false;
  }

  function waitForCapture(targetLanguage, timeoutMs, requestId) {
    // Phase 3 (RC extraction bug): check immediately in case the capture
    // already arrived before this was even called -- never wait a full
    // poll tick just to notice something that's already there.
    const immediate = findCapture(targetLanguage);
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        // Lifecycle bug (RC #3): if this request has already reached a
        // terminal state (e.g. a newer request superseded it, or it was
        // already resolved through some other path), stop polling --
        // never let a stale poll loop influence anything after the fact.
        if (requestId !== activeRequestId || activeState === "resolved" || activeState === "failed") {
          clearInterval(poll);
          resolve(null);
          return;
        }
        const capture = findCapture(targetLanguage);
        if (capture || Date.now() >= deadline) {
          clearInterval(poll);
          resolve(capture);
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
    let capture = await waitForCapture(targetLanguage, 4000, requestId);
    log("default-track wait result", requestId, {
      captured: !!capture,
      lang: capture?.lang ?? null,
      kind: capture?.kind ?? null,
    });

    if (requestId !== activeRequestId) {
      log("request superseded, abandoning", requestId, { stage: "after-default-wait" });
      return { ok: false, error: "transcript_unavailable", internalReason: "request_superseded" };
    }

    if (!capture || String(capture.lang ?? "").toLowerCase().split("-")[0] !== String(targetLanguage ?? "").toLowerCase().split("-")[0]) {
      // Either nothing captured yet, or only a non-matching language --
      // opening the real transcript panel makes YouTube's own code issue a
      // fresh, correctly-authenticated request, which our MAIN-world
      // observer will catch.
      const clicked = await clickTranscriptButton();
      log("transcript-panel button clicked", requestId, { clicked });
      const retried = await waitForCapture(targetLanguage, 8000, requestId);
      log("panel-fallback wait result", requestId, {
        captured: !!retried,
        lang: retried?.lang ?? null,
        kind: retried?.kind ?? null,
      });
      if (retried) capture = retried;
    }

    if (requestId !== activeRequestId) {
      log("request superseded, abandoning", requestId, { stage: "after-panel-fallback" });
      return { ok: false, error: "transcript_unavailable", internalReason: "request_superseded" };
    }

    if (!capture) {
      // findCapture() always falls back to "whatever was captured first" when
      // captures.size > 0 (never invents data, but prefers partial reality
      // over nothing), so reaching this branch means captures.size is
      // genuinely 0 for this video -- not one single usable caption track
      // was ever observed. This is what makes "no subtitles for this video"
      // an honest statement (Phase 11): if anything at all had been
      // captured, capture above would already be truthy.
      activeState = "failed";
      log("extraction result: failed", requestId, { reason: "timedtext_not_observed" });
      return { ok: false, error: "transcript_unavailable", internalReason: "timedtext_not_observed" };
    }

    // First valid result wins: mark this request resolved BEFORE returning,
    // so any still-in-flight poll loop for this requestId (there shouldn't
    // be one left, but this is the explicit guarantee) sees a terminal
    // state and stops influencing anything.
    activeState = "resolved";
    log("extraction result: ok", requestId, {
      lang: capture.lang,
      kind: capture.kind,
      bodyLength: capture.bodyText?.length ?? 0,
    });
    return {
      ok: true,
      capture: { lang: capture.lang, kind: capture.kind, bodyText: capture.bodyText },
      metadata,
    };
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
