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
(() => {
  const captures = new Map(); // key: `${lang}|${kind}` -> {lang, kind, bodyText}
  let metadata = null;

  document.addEventListener("lexreader:transcript-captured", (event) => {
    const detail = event.detail;
    if (!detail) return;
    if (detail.type === "metadata") {
      metadata = detail;
      return;
    }
    if (detail.type === "timedtext") {
      const key = `${detail.lang ?? ""}|${detail.kind ?? ""}`;
      captures.set(key, detail);
      console.debug("[LexReader:diag] capture stored", {
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
    // video's own default track), never invent data.
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

  function waitForCapture(targetLanguage, timeoutMs) {
    // Phase 3 (RC extraction bug): check immediately in case the capture
    // already arrived before this was even called -- never wait a full
    // poll tick just to notice something that's already there.
    const immediate = findCapture(targetLanguage);
    if (immediate) return Promise.resolve(immediate);

    return new Promise((resolve) => {
      const deadline = Date.now() + timeoutMs;
      const poll = setInterval(() => {
        const capture = findCapture(targetLanguage);
        if (capture || Date.now() >= deadline) {
          clearInterval(poll);
          resolve(capture);
        }
      }, 200);
    });
  }

  async function extractTranscript(targetLanguage) {
    console.debug("[LexReader:diag] extraction requested", { targetLanguage });

    // The video's own default caption track is usually already captured
    // automatically within a couple seconds of page load (real, proven
    // behavior -- no click needed). Give that a short window first.
    let capture = await waitForCapture(targetLanguage, 4000);
    console.debug("[LexReader:diag] default-track wait result", {
      captured: !!capture,
      lang: capture?.lang ?? null,
      kind: capture?.kind ?? null,
    });

    if (!capture || String(capture.lang ?? "").toLowerCase().split("-")[0] !== String(targetLanguage ?? "").toLowerCase().split("-")[0]) {
      // Either nothing captured yet, or only a non-matching language --
      // opening the real transcript panel makes YouTube's own code issue a
      // fresh, correctly-authenticated request, which our MAIN-world
      // observer will catch.
      const clicked = await clickTranscriptButton();
      console.debug("[LexReader:diag] transcript-panel button clicked", { clicked });
      const retried = await waitForCapture(targetLanguage, 8000);
      console.debug("[LexReader:diag] panel-fallback wait result", {
        captured: !!retried,
        lang: retried?.lang ?? null,
        kind: retried?.kind ?? null,
      });
      if (retried) capture = retried;
    }

    if (!capture) {
      console.debug("[LexReader:diag] extraction result: timedtext_not_observed");
      return { ok: false, error: "transcript_unavailable", internalReason: "timedtext_not_observed" };
    }

    console.debug("[LexReader:diag] extraction result: ok", {
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
    console.debug("[LexReader:diag] extraction message received");
    extractTranscript(message.targetLanguage).then(sendResponse);
    return true; // keep the message channel open for the async response
  });

  // Tell the background service worker this tab is ready to receive
  // extraction requests (it may have just been created for this purpose).
  console.debug("[LexReader:diag] page relay ready, announcing to background");
  chrome.runtime.sendMessage({ type: "LEXREADER_PAGE_READY" }).catch(() => {});
})();
