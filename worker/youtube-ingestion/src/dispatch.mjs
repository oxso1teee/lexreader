// The real provider-chain dispatcher -- production successor to
// research/youtube-transcript/provider-chain.mjs, which proved this exact
// control-flow shape with injected failures. Here, every provider is real.
// Order (measured evidence, production-architecture.md §5):
//   yt_dlp_caption -> innertube -> speech_to_text
// browser_bridge is intentionally NOT in this list -- it's a client-side
// Tier 0 attempted before a worker job ever exists (see that doc's §4/§5),
// not a step this server-side dispatcher can retry.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fetchMetadata } from "./metadata.mjs";
import { ytDlpCaptionProvider } from "./providers/yt-dlp-caption.mjs";
import { innertubeProvider } from "./providers/innertube.mjs";
import { speechToTextProvider } from "./providers/speech-to-text.mjs";
import { normalizeTranscriptResult } from "./normalize.mjs";
import { IngestionError, ProviderFailure, ErrorCategory } from "./errors.mjs";
import { MAX_VIDEO_DURATION_SECONDS, MAX_STT_DURATION_SECONDS } from "./limits.mjs";
import { assertValidVideoId } from "./video-id.mjs";

function withTimeout(promise, ms, onTimeoutCategory, providerName) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new ProviderFailure(providerName, onTimeoutCategory, `${providerName} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @param {{videoId: string, targetLanguage: string, pythonBin: string, whisperModel: string}} input
 * @param {{fetchMetadataFn?: typeof fetchMetadata, ytDlpCaptionFn?: typeof ytDlpCaptionProvider, innertubeFn?: typeof innertubeProvider, speechToTextFn?: typeof speechToTextProvider}} [deps]
 *   Injectable provider implementations — production call sites never pass
 *   this; tests use it to mock external YouTube deterministically (§18).
 * @returns {Promise<{transcript: import("./types.mjs").TranscriptResult, attempts: {provider:string, outcome:string, category?:string}[]}>}
 */
export async function dispatchTranscript({ videoId, targetLanguage, pythonBin, whisperModel }, deps = {}) {
  const {
    fetchMetadataFn = fetchMetadata,
    ytDlpCaptionFn = ytDlpCaptionProvider,
    innertubeFn = innertubeProvider,
    speechToTextFn = speechToTextProvider,
    timeoutsMs = { ytDlpCaption: 35_000, innertube: 20_000, speechToText: 9.5 * 60_000 },
  } = deps;
  assertValidVideoId(videoId);
  const attempts = [];

  const meta = await fetchMetadataFn(videoId);
  if (meta.durationSeconds !== undefined && meta.durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
    throw new IngestionError(
      ErrorCategory.VIDEO_TOO_LONG,
      `Video duration ${meta.durationSeconds}s exceeds the ${MAX_VIDEO_DURATION_SECONDS}s import limit`,
    );
  }
  const durationMs = meta.durationSeconds !== undefined ? meta.durationSeconds * 1000 : undefined;

  const workDir = path.join(os.tmpdir(), `ingest-${crypto.randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });

  try {
    // 1. yt_dlp_caption -- proven, tried first.
    try {
      const raw = await withTimeout(
        ytDlpCaptionFn({ videoId, targetLanguage, title: meta.title, durationMs, workDir }),
        timeoutsMs.ytDlpCaption,
        ErrorCategory.TIMEOUT,
        "yt_dlp_caption",
      );
      attempts.push({ provider: "yt_dlp_caption", outcome: "success" });
      return { transcript: normalizeTranscriptResult(raw), attempts };
    } catch (err) {
      attempts.push({ provider: "yt_dlp_caption", outcome: "failed", category: err.category, reason: err.message });
    }

    // 2. innertube -- bounded fallback, never primary.
    try {
      const raw = await withTimeout(
        innertubeFn({ videoId, targetLanguage }),
        timeoutsMs.innertube,
        ErrorCategory.TIMEOUT,
        "innertube",
      );
      attempts.push({ provider: "innertube", outcome: "success" });
      return { transcript: normalizeTranscriptResult(raw), attempts };
    } catch (err) {
      attempts.push({ provider: "innertube", outcome: "failed", category: err.category, reason: err.message });
    }

    // 3. speech_to_text -- terminal fallback. Gated by its own, tighter
    // duration cap (§12): don't attempt an expensive transcription run on a
    // video we already know is too long for it.
    if (meta.durationSeconds !== undefined && meta.durationSeconds > MAX_STT_DURATION_SECONDS) {
      attempts.push({ provider: "speech_to_text", outcome: "skipped", category: ErrorCategory.VIDEO_TOO_LONG });
      throw new IngestionError(
        ErrorCategory.VIDEO_TOO_LONG,
        `Captions unavailable and video exceeds the ${MAX_STT_DURATION_SECONDS}s speech-to-text limit`,
      );
    }

    try {
      const raw = await withTimeout(
        speechToTextFn({ videoId, title: meta.title, durationMs, workDir, pythonBin, whisperModel }),
        timeoutsMs.speechToText,
        ErrorCategory.TIMEOUT,
        "speech_to_text",
      );
      attempts.push({ provider: "speech_to_text", outcome: "success" });
      return { transcript: normalizeTranscriptResult(raw), attempts };
    } catch (err) {
      attempts.push({ provider: "speech_to_text", outcome: "failed", category: err.category, reason: err.message });
      throw new IngestionError(
        err.category ?? ErrorCategory.TRANSCRIPTION_FAILED,
        "All providers in the chain were exhausted",
        { attempts },
      );
    }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
