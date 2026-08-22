import type { TranscriptResult, TranscriptSegment } from "./types.ts";

const TRANSCRIPT_SOURCES = new Set<TranscriptResult["source"]>([
  "manual_caption",
  "auto_caption",
  "innertube",
  "browser_bridge",
  "yt_dlp_caption",
  "speech_to_text",
]);

// Defense-in-depth trust-boundary check on whatever the worker returns.
// Deliberately NOT a second normalization pass (the worker already
// normalizes, per production-architecture.md §11) -- this REJECTS
// non-conforming data rather than silently "fixing" it, so a misbehaving
// worker fails loudly instead of writing bad rows to caption_segments.
export class MalformedTranscriptError extends Error {}

function isValidSegment(s: unknown): s is TranscriptSegment {
  if (!s || typeof s !== "object") return false;
  const seg = s as Partial<TranscriptSegment>;
  return (
    typeof seg.startMs === "number" &&
    Number.isFinite(seg.startMs) &&
    seg.startMs >= 0 &&
    typeof seg.endMs === "number" &&
    Number.isFinite(seg.endMs) &&
    seg.endMs > seg.startMs &&
    typeof seg.text === "string" &&
    seg.text.trim().length > 0
  );
}

export function assertValidTranscriptResult(candidate: unknown): asserts candidate is TranscriptResult {
  if (!candidate || typeof candidate !== "object") {
    throw new MalformedTranscriptError("Transcript result is not an object");
  }
  const t = candidate as Partial<TranscriptResult>;
  if (typeof t.videoId !== "string" || !t.videoId) {
    throw new MalformedTranscriptError("Transcript missing videoId");
  }
  if (typeof t.title !== "string" || !t.title) {
    throw new MalformedTranscriptError("Transcript missing title");
  }
  if (typeof t.languageCode !== "string" || !t.languageCode) {
    throw new MalformedTranscriptError("Transcript missing languageCode");
  }
  if (typeof t.source !== "string" || !TRANSCRIPT_SOURCES.has(t.source as TranscriptResult["source"])) {
    throw new MalformedTranscriptError("Transcript has an invalid source");
  }
  if (
    t.durationMs !== undefined &&
    (typeof t.durationMs !== "number" || !Number.isFinite(t.durationMs) || t.durationMs <= 0)
  ) {
    throw new MalformedTranscriptError("Transcript has an invalid duration");
  }
  if (!Array.isArray(t.segments) || t.segments.length === 0) {
    throw new MalformedTranscriptError("Transcript has no segments");
  }
  if (!t.segments.every(isValidSegment)) {
    throw new MalformedTranscriptError("Transcript contains an invalid segment (bad timestamps or empty text)");
  }
  // ascending order check -- the worker sorts, but never trust it blindly
  for (let i = 1; i < t.segments.length; i++) {
    if (t.segments[i].startMs < t.segments[i - 1].startMs) {
      throw new MalformedTranscriptError("Transcript segments are not in ascending order");
    }
  }
}
