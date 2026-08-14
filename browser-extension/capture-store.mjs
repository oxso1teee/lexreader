// RC extraction bug (M3 Slice 12 RC) — the capture cache/lookup algorithm
// behind youtube-content-relay.js's `captures` Map + findCapture(). Kept as
// a standalone, DOM/chrome-free module purely so the algorithm is
// unit-testable (see wait-for-value.mjs for why this can't literally be
// imported into the real content script). Mirror this exact algorithm there
// if you change it here.
export function createCaptureStore() {
  const captures = new Map();

  return {
    // Empty timedtext bodies are rejected here defensively -- the real
    // capture pipeline (youtube-page-capture.js) already only ever emits a
    // capture event for a non-empty body, so this should never actually
    // reject anything in production; it exists so the invariant is provable
    // in isolation rather than only "true because nothing violates it yet".
    set(detail) {
      if (!detail || !detail.bodyText) return false;
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
