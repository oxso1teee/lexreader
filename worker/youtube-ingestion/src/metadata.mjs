// Cheap metadata-only fetch, done once per job before any provider runs --
// gives us title/duration/availability up front so we can enforce
// video_too_long / video_unavailable BEFORE spending any real
// extraction/transcription compute (§13 of the production architecture doc).
import { runCommand } from "./exec.mjs";
import { assertValidVideoId, canonicalWatchUrl } from "./video-id.mjs";
import { IngestionError, ErrorCategory } from "./errors.mjs";

export async function fetchMetadata(videoId) {
  assertValidVideoId(videoId);
  const url = canonicalWatchUrl(videoId);
  const result = await runCommand(
    "yt-dlp",
    ["--skip-download", "--print", "%(title)s\t%(duration)s\t%(availability)s", url],
    { timeoutMs: 20_000 },
  );

  if (result.timedOut) {
    throw new IngestionError(ErrorCategory.TIMEOUT, "Metadata fetch timed out", result.stderr);
  }
  const stderr = String(result.stderr ?? "");
  if (/429|too many requests/i.test(stderr)) {
    throw new IngestionError(ErrorCategory.RATE_LIMITED, "Rate limited while fetching metadata", stderr);
  }
  if (/private video|video unavailable|removed by the uploader|account.*terminated/i.test(stderr)) {
    throw new IngestionError(ErrorCategory.VIDEO_UNAVAILABLE, "Video is unavailable", stderr);
  }

  const line = String(result.stdout ?? "").trim().split("\n")[0] ?? "";
  const [title, durationRaw, availability] = line.split("\t");
  if (!title) {
    throw new IngestionError(ErrorCategory.VIDEO_UNAVAILABLE, "Could not read video metadata", stderr);
  }
  if (availability && ["private", "premium_only", "subscriber_only", "needs_auth"].includes(availability)) {
    throw new IngestionError(ErrorCategory.VIDEO_UNAVAILABLE, `Video availability is "${availability}"`, stderr);
  }

  const durationSeconds = Number(durationRaw);
  return {
    title,
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : undefined,
  };
}
