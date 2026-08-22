import type { TranscriptResult } from "./types.ts";

export type TranscriptDiagnosticMetadata = {
  videoId: string | null;
  segmentCount: number | null;
  durationSeconds: number | null;
  source: string | null;
  serializedPayloadBytes: number | null;
};

export function serializedJsonBytes(value: unknown): number | null {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : new TextEncoder().encode(serialized).byteLength;
  } catch {
    return null;
  }
}

export function transcriptDiagnosticMetadata(candidate: unknown): TranscriptDiagnosticMetadata {
  const transcript = candidate && typeof candidate === "object"
    ? candidate as Partial<TranscriptResult>
    : null;

  return {
    videoId: typeof transcript?.videoId === "string" ? transcript.videoId : null,
    segmentCount: Array.isArray(transcript?.segments) ? transcript.segments.length : null,
    durationSeconds: typeof transcript?.durationMs === "number" && Number.isFinite(transcript.durationMs)
      ? transcript.durationMs / 1000
      : null,
    source: typeof transcript?.source === "string" ? transcript.source : null,
    serializedPayloadBytes: serializedJsonBytes(candidate),
  };
}
