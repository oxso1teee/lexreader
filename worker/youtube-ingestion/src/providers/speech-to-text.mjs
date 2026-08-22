// Terminal fallback -- proven end-to-end (research Round 4 + Round 8, real
// audio, real faster-whisper transcription, verified against ground-truth
// captions). No caption payload is ever read here; this provider only ever
// touches raw downloaded audio. A genuinely empty result (real, safe
// behavior observed on non-speech audio) is treated as a failure, not a
// silently-saved empty transcript -- see production-architecture.md §12.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommand } from "../exec.mjs";
import { assertValidVideoId, canonicalWatchUrl } from "../video-id.mjs";
import { ProviderFailure, ErrorCategory } from "../errors.mjs";
import { MAX_AUDIO_FILE_BYTES } from "../limits.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WHISPER_SCRIPT = path.join(__dirname, "..", "whisper_transcribe.py");
const MAX_SEGMENT_MS = 6000;

function regroupWords(words) {
  const segments = [];
  let current = null;
  for (const w of words) {
    const startMs = Math.round(Number(w.start) * 1000);
    const endMs = Math.round(Number(w.end) * 1000);
    if (!current || endMs - current.startMs > MAX_SEGMENT_MS) {
      if (current) segments.push(current);
      current = { startMs, endMs, text: String(w.word ?? "").trim() };
    } else {
      current.endMs = endMs;
      current.text += w.word;
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * @param {{videoId: string, title: string, durationMs?: number, workDir: string, pythonBin: string, whisperModel: string}} input
 * @returns {Promise<import("../types.mjs").RawProviderResult>}
 */
export async function speechToTextProvider({ videoId, title, durationMs, workDir, pythonBin, whisperModel }) {
  assertValidVideoId(videoId);
  const url = canonicalWatchUrl(videoId);
  const audioPathTemplate = path.join(workDir, `${videoId}.audio.%(ext)s`);
  const audioPath = path.join(workDir, `${videoId}.audio.wav`);

  try {
    const extractResult = await runCommand(
      "yt-dlp",
      ["-x", "--audio-format", "wav", "--postprocessor-args", "ffmpeg:-ar 16000 -ac 1", "-o", audioPathTemplate, url],
      { timeoutMs: 120_000 },
    );
    if (extractResult.timedOut) {
      throw new ProviderFailure("speech_to_text", ErrorCategory.TIMEOUT, "Audio extraction timed out", extractResult.stderr);
    }

    let stat;
    try {
      stat = await fs.stat(audioPath);
    } catch {
      throw new ProviderFailure(
        "speech_to_text",
        ErrorCategory.AUDIO_EXTRACTION_FAILED,
        "yt-dlp did not produce an audio file",
        extractResult.stderr,
      );
    }
    if (stat.size === 0) {
      throw new ProviderFailure("speech_to_text", ErrorCategory.AUDIO_EXTRACTION_FAILED, "Extracted audio file is empty");
    }
    if (stat.size > MAX_AUDIO_FILE_BYTES) {
      throw new ProviderFailure("speech_to_text", ErrorCategory.VIDEO_TOO_LONG, "Extracted audio exceeds the maximum allowed size");
    }

    const whisperResult = await runCommand(pythonBin, [WHISPER_SCRIPT, audioPath, whisperModel], { timeoutMs: 9 * 60_000 });
    if (whisperResult.timedOut) {
      throw new ProviderFailure("speech_to_text", ErrorCategory.TIMEOUT, "Transcription timed out", whisperResult.stderr);
    }

    let parsed;
    try {
      parsed = JSON.parse(whisperResult.stdout);
    } catch {
      throw new ProviderFailure(
        "speech_to_text",
        ErrorCategory.TRANSCRIPTION_FAILED,
        "Whisper subprocess produced unparseable output",
        whisperResult.stderr,
      );
    }

    const segments = regroupWords(parsed.words ?? []);
    if (segments.length === 0) {
      // Real, safe, observed behavior (Round 4/8): genuinely no speech in
      // the audio. This is a real failure of the terminal fallback, not a
      // valid empty transcript to save as "ready."
      throw new ProviderFailure("speech_to_text", ErrorCategory.NO_SPEECH_DETECTED, "No speech detected in extracted audio");
    }

    return {
      videoId,
      title,
      languageCode: parsed.language || "und",
      durationMs,
      source: "speech_to_text",
      segments,
    };
  } finally {
    // Guaranteed cleanup regardless of success/failure -- never leaves temp
    // audio behind.
    await fs.unlink(audioPath).catch(() => {});
  }
}
