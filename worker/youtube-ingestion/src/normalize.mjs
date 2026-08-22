// The one shared transcript normalizer — every provider's raw output passes
// through this before the worker returns a TranscriptResult. Rules per
// docs/ui/m3-slice12-production-architecture.md §11.
import { MAX_SEGMENTS, MAX_TRANSCRIPT_LENGTH } from "./limits.mjs";

const MIN_SEGMENT_MS = 300;

export class TranscriptTooLargeError extends Error {}

function cleanText(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

/**
 * @param {{startMs:number, endMs:number, text:string}[]} rawSegments
 * @returns {{startMs:number, endMs:number, text:string}[]}
 */
export function normalizeSegments(rawSegments) {
  const cleaned = [];
  for (const raw of rawSegments ?? []) {
    const startMs = Math.round(Number(raw?.startMs));
    const endMs = Math.round(Number(raw?.endMs));
    const text = cleanText(raw?.text);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    if (startMs < 0) continue;
    if (endMs <= startMs) continue;
    if (!text) continue;
    cleaned.push({ startMs, endMs, text });
  }

  cleaned.sort((a, b) => a.startMs - b.startMs);

  // Merge pathologically tiny fragments into the following segment rather
  // than keeping a flash-and-gone line — mainly relevant to raw word-level
  // STT output before display-bucket regrouping already merged most of it.
  const merged = [];
  for (const seg of cleaned) {
    const prev = merged[merged.length - 1];
    if (prev && seg.startMs - prev.endMs <= 0 && prev.endMs - prev.startMs < MIN_SEGMENT_MS) {
      prev.endMs = Math.max(prev.endMs, seg.endMs);
      prev.text = cleanText(`${prev.text} ${seg.text}`);
    } else {
      merged.push({ ...seg });
    }
  }

  if (merged.length > MAX_SEGMENTS) {
    throw new TranscriptTooLargeError(`Transcript exceeds ${MAX_SEGMENTS} segments.`);
  }
  const totalLength = merged.reduce((sum, s) => sum + s.text.length + 1, 0);
  if (totalLength > MAX_TRANSCRIPT_LENGTH) {
    throw new TranscriptTooLargeError(`Transcript exceeds ${MAX_TRANSCRIPT_LENGTH} characters.`);
  }

  return merged;
}

/** @param {import("./types.mjs").RawProviderResult} raw */
export function normalizeTranscriptResult(raw) {
  return {
    videoId: raw.videoId,
    title: cleanText(raw.title) || `YouTube ${raw.videoId}`,
    languageCode: raw.languageCode || "und",
    durationMs: Number.isFinite(raw.durationMs) ? Math.round(raw.durationMs) : undefined,
    source: raw.source,
    segments: normalizeSegments(raw.segments),
  };
}
