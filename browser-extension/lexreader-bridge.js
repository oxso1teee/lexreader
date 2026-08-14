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
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  if (!ALLOWED_ORIGINS.has(window.location.origin)) return;

  function postToPage(message) {
    window.postMessage({ source: SOURCE, ...message }, window.location.origin);
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
      },
      (response) => {
        if (chrome.runtime.lastError) {
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

        // Never log transcript contents (Phase 1) -- ok/error only.
        console.debug("[LexReader:diag] response sent to LexReader", {
          requestId: message.requestId,
          ok: Boolean(response?.ok),
          error: response?.error ?? null,
        });
        postToPage({
          type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE",
          requestId: message.requestId,
          ok: Boolean(response?.ok),
          transcript: response?.transcript,
          error: response?.error,
          message: response?.message,
        });
      },
    );
  });

  announceReady();
})();
