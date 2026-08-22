// RC extraction bug (M3 Slice 12 RC) — the capture cache/lookup algorithm
// behind youtube-content-relay.js's `captures` Map + findCapture(). Kept as
// a standalone, DOM/chrome-free module so exact-video rejection remains
// unit-testable. MV3 classic content scripts cannot import it directly, so
// changes here must remain synchronized with the relay implementation.
//
// Lifecycle bug (M3 Slice 12 RC #3) — real-browser network evidence proved
// YouTube's own autoplay/up-next machinery fires genuine
// /api/timedtext?fmt=json3 requests for a DIFFERENT, unrelated video while
// our extraction tab is still open on the video we're extracting (observed:
// a request for a wholly different videoId landed ~300ms after our own
// video's request, well before any navigation happened on our tab). The
// store used to key purely on `lang|kind`, so a same-key capture from that
// unrelated video could silently overwrite or be returned as a match for
// the video actually being extracted. `expectedVideoId` closes that gap:
// every write and read is scoped to one specific video, so a capture for
// any other video is never stored and never returned, regardless of key
// collisions.
export function createCaptureStore(expectedVideoId) {
  const captures = new Map();

  return {
    // Empty timedtext bodies are rejected here defensively -- the real
    // capture pipeline (youtube-page-capture.js) already only ever emits a
    // capture event for a non-empty body, so this should never actually
    // reject anything in production; it exists so the invariant is provable
    // in isolation rather than only "true because nothing violates it yet".
    set(detail) {
      if (!detail || !detail.bodyText) return false;
      if (expectedVideoId && detail.videoId && detail.videoId !== expectedVideoId) return false;
      const key = `${detail.lang ?? ""}|${detail.kind ?? ""}`;
      captures.set(key, detail);
      return true;
    },
    find(targetLanguage) {
      const target = String(targetLanguage ?? "").toLowerCase();
      const baseTarget = target.split("-")[0];
      for (const capture of captures.values()) {
        const lang = String(capture.lang ?? "").toLowerCase();
        if (lang === target || lang.split("-")[0] === baseTarget) return capture;
      }
      // No exact match -- fall back to whatever was captured first (the
      // video's own default track), never invent data.
      return captures.values().next().value ?? null;
    },
    get size() {
      return captures.size;
    },
  };
}
