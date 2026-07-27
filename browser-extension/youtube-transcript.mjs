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

function extractJsonValueAfterKey(source, key, opening, closing) {
  const keyIndex = source.indexOf(`"${key}"`);
  if (keyIndex === -1) return null;

  const start = source.indexOf(opening, keyIndex + key.length + 2);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index++) {
    const char = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opening) depth++;
    if (char === closing) {
      depth--;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return null;
}

export function extractCaptionTracks(html) {
  const rawTracks = extractJsonValueAfterKey(html, "captionTracks", "[", "]");
  if (!rawTracks) return [];

  try {
    const tracks = JSON.parse(rawTracks);
    return Array.isArray(tracks)
      ? tracks.filter(
          (track) =>
            track &&
            typeof track.baseUrl === "string" &&
            typeof track.languageCode === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function extractTitle(html, videoId) {
  const rawVideoDetails = extractJsonValueAfterKey(html, "videoDetails", "{", "}");
  if (rawVideoDetails) {
    try {
      const details = JSON.parse(rawVideoDetails);
      if (typeof details.title === "string" && details.title.trim()) {
        return details.title.trim().slice(0, 300);
      }
    } catch {
      // Fallback to the meta title below.
    }
  }

  const metaTitle = html.match(/<meta\s+name=["']title["']\s+content=["']([^"']*)["']/i);
  return metaTitle ? decodeEntities(metaTitle[1]).trim().slice(0, 300) : `YouTube ${videoId}`;
}

function selectCaptionTrack(tracks, targetLanguage) {
  const target = String(targetLanguage ?? "").toLowerCase();
  const baseTarget = target.split("-")[0];
  const matching = tracks.filter((track) => {
    const language = track.languageCode.toLowerCase();
    return language === target || language.split("-")[0] === baseTarget;
  });

  return (
    matching.find((track) => track.kind !== "asr") ??
    matching[0] ??
    tracks.find((track) => track.kind !== "asr") ??
    tracks[0]
  );
}

function cleanSegmentBody(body) {
  return decodeEntities(String(body ?? "")).replace(/\s+/g, " ").trim();
}

export function parseJson3Segments(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const rawSegments = [];

  for (const event of events) {
    const startMs = Number(event?.tStartMs);
    const durationMs = Number(event?.dDurationMs);
    const body = cleanSegmentBody(
      Array.isArray(event?.segs) ? event.segs.map((segment) => segment?.utf8 ?? "").join("") : "",
    );
    if (!Number.isFinite(startMs) || startMs < 0 || !body) continue;
    rawSegments.push({
      startMs: Math.round(startMs),
      durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0,
      body,
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
    return { startMs: segment.startMs, endMs, body: segment.body };
  });
}

function parseXmlAttribute(attributes, name) {
  const match = attributes.match(new RegExp(`${name}=["']([\\d.]+)["']`));
  return match ? Number(match[1]) : null;
}

export function parseTimedTextSegments(xml) {
  const segments = [];
  for (const match of xml.matchAll(/<text\s+([^>]*)>([\s\S]*?)<\/text>/g)) {
    const start = parseXmlAttribute(match[1], "start");
    const duration = parseXmlAttribute(match[1], "dur") ?? 2;
    const body = cleanSegmentBody(match[2].replace(/<[^>]+>/g, ""));
    if (!Number.isFinite(start) || start < 0 || !body) continue;
    const startMs = Math.round(start * 1_000);
    segments.push({
      startMs,
      endMs: startMs + Math.max(1, Math.round(duration * 1_000)),
      body,
    });
  }
  return segments;
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
    totalLength += segment.body.length + 1;
    if (totalLength > MAX_TRANSCRIPT_LENGTH) {
      throw new Error("Субтитры этого видео слишком длинные для импорта.");
    }
  }
}

export async function fetchYoutubeTranscript(
  rawUrl,
  targetLanguage,
  fetchImpl = globalThis.fetch,
) {
  const videoId = extractVideoId(rawUrl);
  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
    throw new Error("Не распознана ссылка на YouTube-видео.");
  }

  const watchResponse = await fetchImpl(`https://www.youtube.com/watch?v=${videoId}`, {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!watchResponse.ok) {
    throw new Error(`YouTube не открыл видео (HTTP ${watchResponse.status}).`);
  }

  const html = await watchResponse.text();
  const tracks = extractCaptionTracks(html);
  if (tracks.length === 0) {
    throw new Error(
      "У видео нет открытых субтитров. Для видео без субтитров позже добавим отдельное распознавание аудио.",
    );
  }

  const track = selectCaptionTrack(tracks, targetLanguage);
  const captionUrl = new URL(track.baseUrl, "https://www.youtube.com");
  captionUrl.searchParams.set("fmt", "json3");

  const captionResponse = await fetchImpl(captionUrl.toString(), {
    credentials: "include",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!captionResponse.ok) {
    throw new Error(`YouTube не отдал субтитры (HTTP ${captionResponse.status}).`);
  }

  const captionBody = await captionResponse.text();
  let segments = [];
  try {
    segments = parseJson3Segments(JSON.parse(captionBody));
  } catch {
    segments = parseTimedTextSegments(captionBody);
  }
  enforceTranscriptLimits(segments);

  return {
    videoId,
    title: extractTitle(html, videoId),
    languageCode: track.languageCode,
    segments,
  };
}
