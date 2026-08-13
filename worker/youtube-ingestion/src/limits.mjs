// MVP limits — deliberately conservative for v1 (per production-architecture
// doc §12/§13). Documented here as the single source of truth for the
// worker; the Next.js side keeps a mirrored copy in
// src/lib/youtube-ingestion/limits.ts for upfront checks before dispatch.

export const MAX_VIDEO_DURATION_SECONDS = 60 * 60; // 60 min for caption-path providers
export const MAX_STT_DURATION_SECONDS = 30 * 60; // 30 min for the STT fallback specifically (§12: ~7-8x realtime measured, keeps the job timeout comfortable)
export const MAX_SEGMENTS = 10_000; // matches the already-proven browser-extension constant
export const MAX_TRANSCRIPT_LENGTH = 200_000; // chars, matches the already-proven browser-extension constant
export const MAX_AUDIO_FILE_BYTES = 200 * 1024 * 1024; // 200MB — generous margin over a 30-min 16kHz-mono WAV (~55MB expected)
export const MAX_CONCURRENT_JOBS = 2; // per worker instance (§12 — memory-constrained MVP box)
export const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes, hard per-job ceiling
export const YT_DLP_PROVIDER_TIMEOUT_MS = 30_000;
export const INNERTUBE_PROVIDER_TIMEOUT_MS = 15_000;
