// Strict validation — the single trust boundary between "whatever a caller
// sent us" and "a string we'll place into a shell argument array or a
// constructed YouTube URL." Mirrors the exact regex already proven across
// browser-extension/youtube-transcript.mjs and src/app/(app)/library/youtube-actions.ts.
// Never widen this without a real reason — it's deliberately conservative.

const VIDEO_ID_PATTERN = /^[\w-]{6,20}$/;
const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export class InvalidVideoIdError extends Error {}

export function isValidVideoId(candidate) {
  return typeof candidate === "string" && VIDEO_ID_PATTERN.test(candidate);
}

/** Extracts a video ID from a raw YouTube URL string. Returns null if the
 * host isn't on the allowlist or no ID can be found — never throws on bad
 * input, since this is meant to be used for parsing untrusted URLs. */
export function extractVideoId(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return isValidVideoId(id) ? id : null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname) && host !== "youtube.com") return null;
  if (url.pathname === "/watch") {
    const id = url.searchParams.get("v");
    return isValidVideoId(id ?? "") ? id : null;
  }
  const match = url.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/);
  return match && isValidVideoId(match[1]) ? match[1] : null;
}

/** Asserts a video ID is well-formed. Throws InvalidVideoIdError otherwise —
 * call this immediately before building any shell argument or URL, as
 * defense in depth even when the ID supposedly already came from
 * extractVideoId(). Never build a URL/argument from an unvalidated ID. */
export function assertValidVideoId(candidate) {
  if (!isValidVideoId(candidate)) {
    throw new InvalidVideoIdError(`Invalid YouTube video ID: ${JSON.stringify(candidate)}`);
  }
}

export function canonicalWatchUrl(videoId) {
  assertValidVideoId(videoId);
  return `https://www.youtube.com/watch?v=${videoId}`;
}
