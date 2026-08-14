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
 * Builds the canonical TranscriptResult from an already-captured, real
 * YouTube timedtext response (json3 body text) plus the page metadata
 * captured alongside it. Throws on malformed/empty input rather than
 * silently producing a partial transcript -- callers must treat a thrown
 * error as extraction failure, never as "zero segments is fine."
 */
export function buildTranscriptResult({ videoId, title, lengthSeconds, lang, kind, bodyText }) {
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    throw new Error("Не распознан ID видео.");
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error("YouTube вернул повреждённые субтитры.");
  }

  const segments = parseJson3Segments(payload);
  enforceTranscriptLimits(segments);

  const durationMs = Number.isFinite(Number(lengthSeconds)) ? Math.round(Number(lengthSeconds) * 1000) : undefined;

  return {
    videoId,
    title: title ? String(title).trim().slice(0, 300) : `YouTube ${videoId}`,
    languageCode: lang || "und",
    durationMs,
    source: kind === "asr" ? "auto_caption" : "manual_caption",
    segments,
  };
}
