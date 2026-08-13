// Typed failure categories (§16 of the production architecture doc). Every
// provider/pipeline failure gets mapped to exactly one of these before it
// crosses the worker's HTTP boundary — never a raw yt-dlp/ffmpeg stderr
// string. Raw diagnostics stay server-side, attached as `.detail` for logs
// only, never serialized into the HTTP response body's user-facing fields.

export const ErrorCategory = Object.freeze({
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
});

export class IngestionError extends Error {
  /** @param {string} category one of ErrorCategory @param {string} message @param {unknown} [detail] server-only diagnostic, never sent to the client */
  constructor(category, message, detail) {
    super(message);
    this.category = category;
    this.detail = detail;
  }
}

export class ProviderFailure extends Error {
  /** @param {string} provider @param {string} category @param {string} message @param {unknown} [detail] */
  constructor(provider, category, message, detail) {
    super(message);
    this.provider = provider;
    this.category = category;
    this.detail = detail;
  }
}
