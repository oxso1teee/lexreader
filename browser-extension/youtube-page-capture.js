// MAIN-world content script (real YouTube page JS context, not the
// extension's isolated world) -- runs on https://www.youtube.com/watch*
// before YouTube's own scripts. Real research (Slice 12, Gate #2C) proved
// that manually re-fetching a caption track's baseUrl (from
// ytInitialPlayerResponse or a scraped watch page) returns HTTP 200 with an
// EMPTY body: YouTube's timedtext endpoint now requires a `pot`
// (Proof-of-Origin Token) query param that only YouTube's own page code can
// generate via its internal BotGuard challenge. We never try to synthesize
// that token ourselves -- instead we observe the REAL, pot-bearing
// /api/timedtext request the page's own player already makes on its own
// (confirmed firing automatically on normal video load, no click needed,
// for the video's default caption track; the transcript-panel button
// triggers the same real request for a specific language on demand). Real
// testing also found this specific request goes out via XMLHttpRequest, not
// fetch() -- both are patched below, since patching only one silently
// misses the real response.
(() => {
  const originalFetch = window.fetch;
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  function parseTimedtextMeta(urlString) {
    try {
      const url = new URL(urlString, location.href);
      if (!url.pathname.includes("/api/timedtext")) return null;
      return {
        lang: url.searchParams.get("lang"),
        kind: url.searchParams.get("kind"), // "asr" => auto-generated
        fmt: url.searchParams.get("fmt"),
        videoId: url.searchParams.get("v"),
      };
    } catch {
      return null;
    }
  }

  function emit(detail) {
    document.dispatchEvent(new CustomEvent("lexreader:transcript-captured", { detail }));
  }

  window.fetch = async function patchedFetch(input, init) {
    const response = await originalFetch(input, init);
    try {
      const urlString = typeof input === "string" ? input : input?.url;
      const meta = parseTimedtextMeta(urlString);
      if (meta && meta.fmt === "json3" && response.ok) {
        // Clone so YouTube's own consumption of the real response is never
        // disrupted -- we only ever observe, never intercept/replace.
        const bodyText = await response.clone().text();
        if (bodyText && bodyText.length > 0) {
          emit({ type: "timedtext", ...meta, bodyText });
        }
      }
    } catch {
      // Never let observation break the page's own real request.
    }
    return response;
  };

  // Real evidence (Gate #2C real-browser test): YouTube's own player issues
  // the pot-authenticated timedtext request via XMLHttpRequest, not fetch()
  // -- both must be patched or the real, successful response is invisible
  // to us even though it reaches the page just fine.
  XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
    this.__lexreaderUrl = url;
    return originalXhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function patchedSend(...args) {
    const meta = parseTimedtextMeta(this.__lexreaderUrl);
    if (meta && meta.fmt === "json3") {
      this.addEventListener("load", () => {
        try {
          if (this.status >= 200 && this.status < 300 && this.responseText) {
            emit({ type: "timedtext", ...meta, bodyText: this.responseText });
          }
        } catch {
          // Never let observation break the page's own real request.
        }
      });
    }
    return originalXhrSend.apply(this, args);
  };

  // ytInitialPlayerResponse is set by YouTube's own inline <script> after
  // document_start (when this file's matches condition executes) — poll
  // briefly rather than assume it's present immediately.
  let attempts = 0;
  const maxAttempts = 40; // ~10s at 250ms
  const poll = setInterval(() => {
    attempts += 1;
    const pr = window.ytInitialPlayerResponse;
    const tracks = pr?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    if (pr?.videoDetails?.videoId) {
      clearInterval(poll);
      emit({
        type: "metadata",
        videoId: pr.videoDetails.videoId,
        title: pr.videoDetails.title,
        lengthSeconds: pr.videoDetails.lengthSeconds,
        availableTracks: Array.isArray(tracks)
          ? tracks.map((t) => ({ languageCode: t.languageCode, kind: t.kind ?? null }))
          : [],
      });
    } else if (attempts >= maxAttempts) {
      clearInterval(poll);
    }
  }, 250);
})();
