// Canonical, provider-independent transcript shape — Video/UI code must
// never need provider-specific parsing (Slice 12 brief §3). Mirrors
// worker/youtube-ingestion's contract exactly.
export type TranscriptSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type TranscriptSource =
  | "manual_caption"
  | "auto_caption"
  | "innertube"
  | "browser_bridge"
  | "yt_dlp_caption"
  | "speech_to_text";

export type TranscriptResult = {
  videoId: string;
  title: string;
  languageCode: string;
  durationMs?: number;
  source: TranscriptSource;
  segments: TranscriptSegment[];
};

export const ErrorCategory = {
  INVALID_URL: "invalid_url",
  VIDEO_UNAVAILABLE: "video_unavailable",
  VIDEO_TOO_LONG: "video_too_long",
  RATE_LIMITED: "rate_limited",
  CAPTIONS_FAILED: "captions_failed",
  AUDIO_EXTRACTION_FAILED: "audio_extraction_failed",
  TRANSCRIPTION_FAILED: "transcription_failed",
  NO_SPEECH_DETECTED: "no_speech_detected",
  TIMEOUT: "timeout",
  WORKER_UNAVAILABLE: "worker_unavailable",
  STORAGE_FAILED: "storage_failed",
} as const;

export type ErrorCategoryValue = (typeof ErrorCategory)[keyof typeof ErrorCategory];

export type ProcessingStatus = "pending" | "processing" | "ready" | "failed";

export type ProcessingStage =
  | "validating"
  | "metadata"
  | "finding_captions"
  | "downloading_captions"
  | "extracting_audio"
  | "transcribing"
  | "normalizing"
  | "saving";

export type ImportOutcome = {
  textId: string;
  status: ProcessingStatus;
  stage: ProcessingStage | null;
  error: ErrorCategoryValue | null;
  readyRoute?: string;
};
