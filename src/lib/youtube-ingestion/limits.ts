// Mirrors worker/youtube-ingestion/src/limits.mjs (§8 of the Slice 12
// brief). The Next.js side only needs a subset — enough to reject an
// obviously-too-long request or a spamming user before ever calling the
// worker; the worker enforces the authoritative versions of these same
// limits independently (defense in depth, not duplication for its own sake).
export const MAX_VIDEO_DURATION_SECONDS = 60 * 60;
// Browser-primary imports have already paid the extraction cost in the
// user's own tab and persist only normalized caption rows. Keep the worker/
// STT cap unchanged while allowing the proven 116-minute DOM transcript.
export const MAX_BROWSER_BRIDGE_VIDEO_DURATION_SECONDS = 2 * 60 * 60;
export const MAX_IMPORTS_PER_USER_PER_HOUR = 10;
