// Lifecycle bug (M3 Slice 12 RC #4) -- pure logic behind the DOM-based
// transcript extraction fallback. Real evidence: a REAL user's browser
// (ordinary Chrome, not automated) showed a genuine, populated YouTube
// transcript panel -- "Расшифровка видео", real timestamped English
// auto-generated caption lines -- yet LexReader still returned
// transcript_unavailable. Direct DOM inspection of YouTube's current
// transcript panel (verified against two real videos, including a 116-
// minute video with a real 1.45MB ASR timedtext body -- 1.2s just to read
// the body in a fast test environment, plausibly much longer on a real
// user's connection) confirmed the real, current row markup:
//   <transcript-segment-view-model>
//     <div class="ytwTranscriptSegmentViewModelTimestamp">0:01</div>
//     <span role="text">segment text</span>
//   </transcript-segment-view-model>
// (YouTube's older Polymer UI used ytd-transcript-segment-renderer with
// different inner selectors -- youtube-content-relay.js queries both,
// defensively, since this file only processes whatever rows it's handed.)
// This module is DOM/chrome-free on purpose so it's unit-testable; the
// actual document.querySelectorAll call lives only in
// youtube-content-relay.js (MV3 content scripts declared via
// manifest.json can't use "type": "module", so that file can't literally
// import this one -- mirror this exact algorithm there by hand).

// Real captions essentially never run this short at a video's very end;
// matches the convention parseJson3Segments already uses for a
// duration-less final event (see youtube-transcript.mjs).
const LAST_SEGMENT_EXTENSION_MS = 4000;

/**
 * Parses a YouTube transcript-panel timestamp label ("0:01", "12:34",
 * "1:02:03") into milliseconds. Returns null for anything that doesn't
 * look like a real timestamp -- callers must drop the row rather than
 * invent a start time.
 */
export function parseTimestampToMs(text) {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (!/^\d{1,2}(:\d{2}){1,2}$/.test(trimmed)) return null;
  const parts = trimmed.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return null;
  const seconds =
    parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  return Math.round(seconds * 1000);
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * rows: array of { timestampText, text } already read out of the DOM by
 * the content script, in DOM order (== chronological order for a
 * transcript panel). Produces the same {startMs, endMs, text} shape
 * parseJson3Segments produces from a real network capture, so both
 * acquisition paths converge on assembleTranscriptResult unchanged.
 * Rows with an unparseable timestamp or empty text are dropped rather
 * than corrupting the sequence.
 */
export function buildSegmentsFromDomRows(rows) {
  const parsed = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const startMs = parseTimestampToMs(row?.timestampText);
    const text = cleanText(row?.text);
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
