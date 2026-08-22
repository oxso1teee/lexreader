// Real yt-dlp caption provider — proven end-to-end in research (both manual
// and auto captions, real timestamps, explicit language selection). This is
// production hardening of that same proven approach, not a rewrite: same
// invocation shape, now wrapped with strict validation, real content checks
// (never treats --list-subs success as transcript success — it downloads
// actual content and parses it), and typed failure categories.
import fs from "node:fs/promises";
import path from "node:path";
import { runCommand } from "../exec.mjs";
import { assertValidVideoId, canonicalWatchUrl } from "../video-id.mjs";
import { ProviderFailure, ErrorCategory } from "../errors.mjs";
import { YT_DLP_PROVIDER_TIMEOUT_MS } from "../limits.mjs";

function classifyStderr(stderr) {
  const s = String(stderr ?? "");
  if (/429|too many requests/i.test(s)) return ErrorCategory.RATE_LIMITED;
  if (/private video|video unavailable|removed by the uploader|account.*terminated/i.test(s)) {
    return ErrorCategory.VIDEO_UNAVAILABLE;
  }
  return ErrorCategory.CAPTIONS_FAILED;
}

function parseJson3Segments(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const segments = [];
  for (const event of events) {
    const startMs = Number(event?.tStartMs);
    const durationMs = Number(event?.dDurationMs);
    const text = Array.isArray(event?.segs) ? event.segs.map((s) => s?.utf8 ?? "").join("") : "";
    if (!Number.isFinite(startMs) || !text.trim()) continue;
    const endMs = Number.isFinite(durationMs) && durationMs > 0 ? startMs + durationMs : startMs + 2000;
    segments.push({ startMs, endMs, text });
  }
  return segments;
}

/** Attempts one caption kind (manual or auto) for one language. Returns
 * segments or null if yt-dlp ran cleanly but produced no file (meaning: that
 * kind genuinely isn't available — not a failure to report up). */
async function attemptDownload({ videoId, targetLanguage, kind, workDir }) {
  const url = canonicalWatchUrl(videoId);
  const outTemplate = path.join(workDir, `${videoId}.${kind}.%(ext)s`);
  const kindFlag = kind === "manual" ? "--write-sub" : "--write-auto-sub";

  const result = await runCommand(
    "yt-dlp",
    [kindFlag, "--sub-lang", targetLanguage, "--sub-format", "json3", "--skip-download", "-o", outTemplate, url],
    { timeoutMs: YT_DLP_PROVIDER_TIMEOUT_MS },
  );

  if (result.timedOut) {
    throw new ProviderFailure("yt_dlp_caption", ErrorCategory.TIMEOUT, `yt-dlp ${kind} caption fetch timed out`, result.stderr);
  }

  const expectedFile = path.join(workDir, `${videoId}.${kind}.${targetLanguage}.json3`);
  let raw;
  try {
    raw = await fs.readFile(expectedFile, "utf8");
  } catch {
    // No file written -- yt-dlp ran fine, this caption kind just isn't
    // available for this language. Not a provider failure, just "try the
    // next kind / next provider."
    return null;
  }

  let segments;
  try {
    segments = parseJson3Segments(JSON.parse(raw));
  } catch (err) {
    throw new ProviderFailure("yt_dlp_caption", ErrorCategory.CAPTIONS_FAILED, "Malformed caption content from yt-dlp", err);
  } finally {
    await fs.unlink(expectedFile).catch(() => {});
  }

  return segments.length > 0 ? segments : null;
}

/**
 * @param {{videoId: string, targetLanguage: string, title: string, durationMs?: number, workDir: string}} input
 * @returns {Promise<import("../types.mjs").RawProviderResult>}
 */
export async function ytDlpCaptionProvider({ videoId, targetLanguage, title, durationMs, workDir }) {
  assertValidVideoId(videoId);

  for (const kind of ["manual", "auto"]) {
    let segments;
    try {
      segments = await attemptDownload({ videoId, targetLanguage, kind, workDir });
    } catch (err) {
      if (err instanceof ProviderFailure) throw err;
      throw new ProviderFailure("yt_dlp_caption", classifyStderr(err?.message), "yt-dlp caption download failed", err);
    }
    if (segments) {
      return {
        videoId,
        title,
        languageCode: targetLanguage,
        durationMs,
        source: kind === "manual" ? "manual_caption" : "auto_caption",
        segments,
      };
    }
  }

  throw new ProviderFailure("yt_dlp_caption", ErrorCategory.CAPTIONS_FAILED, "No usable manual or auto caption content found");
}
