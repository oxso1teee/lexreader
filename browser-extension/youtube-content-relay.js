// Isolated-world content script on youtube.com. Bridges the MAIN-world
// page-capture script (real page JS, no chrome.* access) to the background
// service worker (chrome.* access, no direct page JS access) -- the
// standard two-world pattern for MV3 extensions that need both. Never
// fetches anything itself; only observes CustomEvents the MAIN-world
// script dispatches and relays chrome.runtime messages.
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

  function clickTranscriptButton() {
    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find((el) => {
      const label = (el.getAttribute("aria-label") || "").toLowerCase();
      return (
        (label.includes("transcript") || label.includes("расшифров") || label.includes("стенограм")) &&
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
    // The video's own default caption track is usually already captured
    // automatically within a couple seconds of page load (real, proven
    // behavior -- no click needed). Give that a short window first.
    let capture = await waitForCapture(targetLanguage, 4000);

    if (!capture || String(capture.lang ?? "").toLowerCase().split("-")[0] !== String(targetLanguage ?? "").toLowerCase().split("-")[0]) {
      // Either nothing captured yet, or only a non-matching language --
      // opening the real transcript panel makes YouTube's own code issue a
      // fresh, correctly-authenticated request, which our MAIN-world
      // observer will catch.
      clickTranscriptButton();
      const retried = await waitForCapture(targetLanguage, 6000);
      if (retried) capture = retried;
    }

    if (!capture) {
      return { ok: false, error: "transcript_unavailable" };
    }

    return {
      ok: true,
      capture: { lang: capture.lang, kind: capture.kind, bodyText: capture.bodyText },
      metadata,
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "LEXREADER_EXTRACT_FROM_PAGE") return false;
    extractTranscript(message.targetLanguage).then(sendResponse);
    return true; // keep the message channel open for the async response
  });

  // Tell the background service worker this tab is ready to receive
  // extraction requests (it may have just been created for this purpose).
  chrome.runtime.sendMessage({ type: "LEXREADER_PAGE_READY" }).catch(() => {});
})();
