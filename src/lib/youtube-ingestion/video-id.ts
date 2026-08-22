// Strict validation — TS mirror of worker/youtube-ingestion/src/video-id.mjs.
// Kept deliberately duplicated rather than shared across the two separate
// deployables (Next.js app and worker container); both copies enforce the
// exact same regex proven across the rest of this codebase.
const VIDEO_ID_PATTERN = /^[\w-]{6,20}$/;
const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export class InvalidVideoIdError extends Error {}

export function isValidVideoId(candidate: unknown): candidate is string {
  return typeof candidate === "string" && VIDEO_ID_PATTERN.test(candidate);
}

export function extractVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && isValidVideoId(id) ? id : null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname) && host !== "youtube.com") return null;
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return id && isValidVideoId(id) ? id : null;
  }
  const match = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/);
  return match && isValidVideoId(match[1]) ? match[1] : null;
}

export function assertValidVideoId(candidate: unknown): asserts candidate is string {
  if (!isValidVideoId(candidate)) {
    throw new InvalidVideoIdError(`Invalid YouTube video ID: ${JSON.stringify(candidate)}`);
  }
}

export function canonicalWatchUrl(videoId: string): string {
  assertValidVideoId(videoId);
  return `https://www.youtube.com/watch?v=${videoId}`;
}
