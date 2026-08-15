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

// Safe, request-scoped failure classification for diagnostics. These codes
// deliberately describe the failing boundary without returning raw Postgres,
// auth, or transcript data to the browser.
export const ImportDiagnosticCode = {
  VALIDATION_FAILED: "validation_failed",
  DURATION_LIMIT: "duration_limit",
  RATE_LIMITED: "rate_limited",
  AUTH_FAILED: "auth_failed",
  SCHEMA_MISMATCH: "schema_mismatch",
  TEXT_LOOKUP_FAILED: "text_lookup_failed",
  TEXT_INSERT_FAILED: "text_insert_failed",
  TEXT_UPDATE_FAILED: "text_update_failed",
  CAPTION_INSERT_FAILED: "caption_insert_failed",
  TRANSACTION_FAILED: "transaction_failed",
  PERSISTENCE_TIMEOUT: "persistence_timeout",
  PAYLOAD_TOO_LARGE: "payload_too_large",
  PAYLOAD_COUNT_MISMATCH: "payload_count_mismatch",
  DUPLICATE_VIDEO: "duplicate_video",
} as const;

export type ImportDiagnosticCodeValue =
  (typeof ImportDiagnosticCode)[keyof typeof ImportDiagnosticCode];

export type ImportDiagnosticSink = (
  event: string,
  metadata?: Record<string, unknown>,
) => void;

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
  diagnosticCode?: ImportDiagnosticCodeValue;
  readyRoute?: string;
};
