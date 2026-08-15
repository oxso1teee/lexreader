(() => {
  const SOURCE = "lexreader-youtube-bridge";
  // RC bridge-handshake bug (M3 Slice 12 RC): this origin set MUST stay identical to
  // ALLOWED_APP_ORIGINS in background.mjs. MV3 content scripts declared via
  // manifest.json's content_scripts[].js cannot use a static `import` (only
  // background.service_worker supports "type": "module"), so this can't be a shared
  // module — it has to stay a manually-synced duplicate. allowed-origins.test.mjs
  // parses both files' source and asserts the two sets are identical, specifically so
  // an update to one without the other fails CI instead of silently reproducing this bug.
  const ALLOWED_ORIGINS = new Set([
    "https://lexreader.vercel.app",
    "https://lexreader.app",
    "https://www.lexreader.app",
    "https://lexreader-focoqdkq7-meeeee4.vercel.app",
    "https://lexreader-mnzvtftfs-meeeee4.vercel.app",
    "https://lexreader-ctoczfjdx-meeeee4.vercel.app",
    "https://lexreader-1zg3zf2nv-meeeee4.vercel.app",
    "https://lexreader-he4dnhye3-meeeee4.vercel.app",
    "https://lexreader-git-feature-import-video-reader-v2-meeeee4.vercel.app",
    "https://lexreader-28rlw6ouq-meeeee4.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  if (!ALLOWED_ORIGINS.has(window.location.origin)) return;
  const pendingRequests = new Set();

  function postToPage(message) {
    window.postMessage({ source: SOURCE, ...message }, window.location.origin);
  }

  function postTerminalToPage(requestId, result) {
    postToPage({
      type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE",
      requestId,
      ok: Boolean(result?.ok),
      transcript: result?.transcript,
      diagnostics: result?.diagnostics,
      error: result?.error,
      message: result?.message,
    });
  }

  function announceReady() {
    chrome.runtime.sendMessage(
      { type: "LEXREADER_YOUTUBE_BRIDGE_PING" },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok) return;
        postToPage({ type: "LEXREADER_YOUTUBE_BRIDGE_READY" });
      },
    );
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== "lexreader-web") return;

    if (message.type === "LEXREADER_YOUTUBE_BRIDGE_PING") {
      announceReady();
      return;
    }

    if (
      message.type !== "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST" ||
      typeof message.requestId !== "string"
    ) {
      return;
    }
    pendingRequests.add(message.requestId);

    chrome.runtime.sendMessage(
      {
        type: "LEXREADER_YOUTUBE_TRANSCRIPT_REQUEST",
        // Lifecycle bug (M3 Slice 12 RC #3): requestId was validated above
        // but never actually forwarded here -- background.mjs and
        // everything downstream had zero visibility into which logical
        // request was in flight, making it impossible to tell a late/stale
        // result apart from the current one. Forwarding it is what lets the
        // rest of the chain log and reason per-request.
        requestId: message.requestId,
        url: message.url,
        targetLanguage: message.targetLanguage,
        // Debug/proof-only switch. In this mode background opens a tab whose
        // MAIN-world capture script does not patch fetch/XHR at all, and it
        // never invokes the network fallback phase.
        domOnly: message.domOnly === true,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          if (!pendingRequests.has(message.requestId)) return;
          pendingRequests.delete(message.requestId);
          console.debug("[LexReader:diag] response sent to LexReader", {
            requestId: message.requestId,
            ok: false,
            error: "extension_not_connected",
          });
          postToPage({
            type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE",
            requestId: message.requestId,
            ok: false,
            error: "extension_not_connected",
            message: "LexReader Bridge отключён. Перезапусти расширение и обнови страницу.",
          });
          return;
        }

        if (response?.deliveredViaTabMessage) {
          console.debug("[LexReader:diag] background_request_channel_completed", {
            requestId: message.requestId,
            lifecycleError: response.lifecycleError ?? null,
          });
          return;
        }

        // Explicit origin delivery failed before the bridge could ACK it.
        // The original request channel is retained as a diagnostic fallback
        // so the page gets a distinct error instead of timing out silently.
        if (!pendingRequests.has(message.requestId)) return;
        pendingRequests.delete(message.requestId);
        console.debug("[LexReader:diag] origin_delivery_failed", {
          requestId: message.requestId,
          error: response?.error ?? "origin_delivery_failed",
        });
        postTerminalToPage(message.requestId, response);
      },
    );
  });

  // Request-scoped progress and explicit terminal delivery. Terminal payloads
  // arrive through tabs.sendMessage and are acknowledged synchronously after
  // forwarding to the page; the original long-lived channel only reports
  // lifecycle completion or a delivery failure and never duplicates success.
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (
      message?.type === "LEXREADER_TRANSCRIPT_RESULT" &&
      typeof message.requestId === "string"
    ) {
      if (!pendingRequests.has(message.requestId)) {
        sendResponse({ ok: false, requestId: message.requestId, error: "stale_request" });
        return false;
      }
      pendingRequests.delete(message.requestId);
      console.debug(
        `[LexReader:diag] ${message.result?.ok ? "lexreader_bridge_received_success" : "lexreader_bridge_received_failure"}`,
        {
          requestId: message.requestId,
          ok: Boolean(message.result?.ok),
          acquisitionSource: message.result?.diagnostics?.acquisitionSource ?? null,
          uniqueSegments: message.result?.diagnostics?.uniqueSegments ?? message.result?.transcript?.segments?.length ?? 0,
        },
      );
      postTerminalToPage(message.requestId, message.result);
      sendResponse({ ok: true, requestId: message.requestId });
      return false;
    }

    if (
      message?.type !== "LEXREADER_EXTRACTION_PROGRESS" ||
      typeof message.requestId !== "string" ||
      typeof message.stage !== "string"
    ) {
      return false;
    }
    postToPage({
      type: "LEXREADER_YOUTUBE_EXTRACTION_PROGRESS",
      requestId: message.requestId,
      stage: message.stage,
      details: message.details,
    });
    return false;
  });

  announceReady();
})();
