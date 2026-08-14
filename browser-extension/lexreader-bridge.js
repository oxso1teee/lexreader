(() => {
  const SOURCE = "lexreader-youtube-bridge";
  const ALLOWED_ORIGINS = new Set([
    "https://lexreader.vercel.app",
    "https://lexreader.app",
    "https://www.lexreader.app",
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
        url: message.url,
        targetLanguage: message.targetLanguage,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          postToPage({
            type: "LEXREADER_YOUTUBE_TRANSCRIPT_RESPONSE",
            requestId: message.requestId,
            ok: false,
            error: "extension_not_connected",
            message: "LexReader Bridge отключён. Перезапусти расширение и обнови страницу.",
          });
          return;
        }

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
