// Canonical browser-side transcript construction (M3 Slice 12 Gate #2C).
// The network layer lives in youtube-page-capture.js/youtube-content-relay.js
// -- this file only does pure parsing/normalization of an already-captured
// real YouTube response, matching the shared TranscriptResult contract from
// src/lib/youtube-ingestion/types.ts exactly (segments use `text`, not the
// old `body` field the pre-Gate-#2C bridge used).
const MAX_SEGMENTS = 10_000;
const MAX_TRANSCRIPT_LENGTH = 200_000;

const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

export function extractVideoId(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? null;
  if (host !== "youtube.com" && host !== "m.youtube.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");

  const pathMatch = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/);
  return pathMatch?.[1] ?? null;
}

function decodeEntities(text) {
  return text.replace(/&(#\d+|[a-z]+);/gi, (whole, code) => {
    if (code.startsWith("#")) {
      const number = Number(code.slice(1));
      return Number.isFinite(number) ? String.fromCodePoint(number) : whole;
    }
    return HTML_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function cleanSegmentText(value) {
  return decodeEntities(String(value ?? "")).replace(/\s+/g, " ").trim();
}

function finalSegmentToleranceMs(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return null;
  if (durationMs <= 60_000) return Math.max(5_000, Math.round(durationMs * 0.35));
  if (durationMs <= 600_000) return Math.max(15_000, Math.min(60_000, Math.round(durationMs * 0.12)));
  return Math.max(60_000, Math.min(300_000, Math.round(durationMs * 0.05)));
}

/**
 * One canonical segment normalizer shared by DOM-primary and network-
 * fallback acquisition. It validates, orders, deduplicates, and derives all
 * end times from the next strictly-later start. The final segment uses video
 * duration only when its start is already plausibly near the end; an
 * incomplete transcript can therefore never be disguised as one segment
 * spanning the rest of a long video.
 */
export function normalizeCanonicalSegments(input, durationMs) {
  const seen = new Set();
  const parsed = [];
  let sequence = 0;
  for (const segment of Array.isArray(input) ? input : []) {
    const startMs = Number(segment?.startMs);
    const text = cleanSegmentText(segment?.text);
    if (!Number.isFinite(startMs) || startMs < 0 || !text) continue;
    const roundedStart = Math.round(startMs);
    const key = `${roundedStart}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push({ startMs: roundedStart, text, sequence: sequence++ });
  }
  parsed.sort((a, b) => a.startMs - b.startMs || a.sequence - b.sequence);

  const numericDuration = Number(durationMs);
  return parsed.map((segment, index) => {
    let nextStart = null;
    for (let nextIndex = index + 1; nextIndex < parsed.length; nextIndex += 1) {
      if (parsed[nextIndex].startMs > segment.startMs) {
        nextStart = parsed[nextIndex].startMs;
        break;
      }
    }

    let endMs = nextStart ?? segment.startMs + 4_000;
    if (index === parsed.length - 1 && Number.isFinite(numericDuration) && numericDuration > segment.startMs) {
      const tolerance = finalSegmentToleranceMs(numericDuration);
      if (tolerance != null && segment.startMs + tolerance >= numericDuration) {
        endMs = Math.round(numericDuration);
      }
    }
    return { startMs: segment.startMs, endMs, text: segment.text };
  });
}

export function parseJson3Segments(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const rawSegments = [];

  for (const event of events) {
    const startMs = Number(event?.tStartMs);
    const durationMs = Number(event?.dDurationMs);
    const text = cleanSegmentText(
      Array.isArray(event?.segs) ? event.segs.map((segment) => segment?.utf8 ?? "").join("") : "",
    );
    if (!Number.isFinite(startMs) || startMs < 0 || !text) continue;
    rawSegments.push({
      startMs: Math.round(startMs),
      durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0,
      text,
    });
  }

  return rawSegments.map((segment, index) => {
    const nextStart = rawSegments[index + 1]?.startMs;
    const endMs =
      segment.durationMs > 0
        ? segment.startMs + segment.durationMs
        : nextStart && nextStart > segment.startMs
          ? nextStart
          : segment.startMs + 2_000;
    return { startMs: segment.startMs, endMs, text: segment.text };
  });
}

function enforceTranscriptLimits(segments) {
  if (segments.length === 0) {
    throw new Error("У этого видео нет доступных субтитров.");
  }
  if (segments.length > MAX_SEGMENTS) {
    throw new Error("Субтитры этого видео слишком длинные для импорта.");
  }

  let totalLength = 0;
  for (const segment of segments) {
    totalLength += segment.text.length + 1;
    if (totalLength > MAX_TRANSCRIPT_LENGTH) {
      throw new Error("Субтитры этого видео слишком длинные для импорта.");
    }
  }
}

/**
 * Assembles the canonical TranscriptResult from already-parsed segments
 * (either from parseJson3Segments, a real network capture, or -- lifecycle
 * bug #4 -- read directly out of YouTube's own rendered transcript-panel
 * DOM when the network capture path misses or is too slow for a large
 * body). Both acquisition paths converge here so validation/limits are
 * enforced exactly once, in exactly one place. Throws on malformed/empty
 * input rather than silently producing a partial transcript -- callers
 * must treat a thrown error as extraction failure, never as "zero segments
 * is fine."
 */
export function assembleTranscriptResult({ videoId, title, lengthSeconds, languageCode, source, segments }) {
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    throw new Error("Не распознан ID видео.");
  }

  const durationMs = Number.isFinite(Number(lengthSeconds)) ? Math.round(Number(lengthSeconds) * 1000) : undefined;
  const normalizedSegments = normalizeCanonicalSegments(segments, durationMs);
  enforceTranscriptLimits(normalizedSegments);

  return {
    videoId,
    title: title ? String(title).trim().slice(0, 300) : `YouTube ${videoId}`,
    languageCode: languageCode || "und",
    durationMs,
    source,
    segments: normalizedSegments,
  };
}

/**
 * Builds the canonical TranscriptResult from an already-captured, real
 * YouTube timedtext response (json3 body text) plus the page metadata
 * captured alongside it.
 */
export function buildTranscriptResult({ videoId, title, lengthSeconds, lang, kind, bodyText }) {
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error("YouTube вернул повреждённые субтитры.");
  }

  const segments = parseJson3Segments(payload);

  return assembleTranscriptResult({
    videoId,
    title,
    lengthSeconds,
    languageCode: lang,
    source: kind === "asr" ? "auto_caption" : "manual_caption",
    segments,
  });
}
