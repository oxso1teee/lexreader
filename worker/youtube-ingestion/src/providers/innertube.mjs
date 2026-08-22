// Bounded fallback -- youtubei.js's transcript parser failed against real
// YouTube during research (Round 1: HTTP 400 from get_transcript, and a
// parser crash on the iOS client profile with a library version behind
// YouTube's current response schema). This provider is kept in the chain
// because it's a genuinely different code path than yt_dlp_caption and
// could succeed where that one doesn't -- but it is NOT relied on as
// primary, and any failure here is caught and the chain continues. Never
// promoted above yt_dlp_caption (see production-architecture.md §5).
import { ProviderFailure, ErrorCategory } from "../errors.mjs";
import { INNERTUBE_PROVIDER_TIMEOUT_MS } from "../limits.mjs";

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * @param {{videoId: string, targetLanguage: string}} input
 * @returns {Promise<import("../types.mjs").RawProviderResult>}
 */
export async function innertubeProvider({ videoId, targetLanguage }) {
  let Innertube;
  try {
    ({ Innertube } = await import("youtubei.js"));
  } catch (err) {
    throw new ProviderFailure("innertube", ErrorCategory.WORKER_UNAVAILABLE, "youtubei.js not installed", err);
  }

  let info;
  try {
    const yt = await withTimeout(
      Innertube.create({ lang: targetLanguage, location: "US", retrieve_player: false }),
      INNERTUBE_PROVIDER_TIMEOUT_MS,
      "innertube client creation",
    );
    info = await withTimeout(yt.getInfo(videoId), INNERTUBE_PROVIDER_TIMEOUT_MS, "innertube getInfo");
  } catch (err) {
    throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "innertube getInfo failed", err?.message ?? err);
  }

  let transcriptData;
  try {
    transcriptData = await withTimeout(info.getTranscript(), INNERTUBE_PROVIDER_TIMEOUT_MS, "innertube getTranscript");
  } catch (err) {
    // Matches the real Round 1 failure mode (HTTP 400 / parser crash) --
    // caught, categorized, and reported up so the dispatcher moves on.
    throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "innertube getTranscript failed", err?.message ?? err);
  }

  const initialSegments = transcriptData?.transcript?.content?.body?.initial_segments ?? [];
  const segments = initialSegments
    .map((s) => ({
      startMs: Number(s.start_ms),
      endMs: Number(s.end_ms),
      text: String(s.snippet?.text ?? ""),
    }))
    .filter((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs) && s.text.trim());

  if (segments.length === 0) {
    throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "innertube returned zero transcript segments");
  }

  return {
    videoId,
    title: info.basic_info?.title ?? `YouTube ${videoId}`,
    languageCode: targetLanguage,
    durationMs: Number.isFinite(info.basic_info?.duration) ? info.basic_info.duration * 1000 : undefined,
    source: "innertube",
    segments,
  };
}
