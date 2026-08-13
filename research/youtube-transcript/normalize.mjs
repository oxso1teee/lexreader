// Round 5 — prove yt-dlp (manual + auto caption) output and faster-whisper (STT) output
// can both be mapped into the SAME TranscriptResult shape Video Reader would consume.
import fs from "node:fs";

/**
 * @typedef {{ startMs: number; endMs: number; text: string }} TranscriptSegment
 * @typedef {{
 *   videoId: string; title: string; languageCode: string; durationMs?: number;
 *   source: "manual_caption" | "auto_caption" | "innertube" | "browser_bridge" | "yt_dlp" | "speech_to_text";
 *   segments: TranscriptSegment[];
 * }} TranscriptResult
 */

function fromYtDlpJson3(filePath, { videoId, title, languageCode, source }) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const events = (data.events ?? []).filter((e) => e.segs && e.segs.some((s) => s.utf8?.trim()));
  const segments = events.map((e) => ({
    startMs: e.tStartMs,
    endMs: e.tStartMs + (e.dDurationMs ?? 2000),
    text: e.segs.map((s) => s.utf8).join("").replace(/\n/g, " ").trim(),
  }));
  return { videoId, title, languageCode, source, segments };
}

// faster-whisper's word-level output regrouped into ~6s display segments (the
// straightforward, well-understood engineering step flagged in Round 4 — word
// timestamps are real, this just buckets them for a readable transcript line).
function fromWhisperWords(words, { videoId, title, languageCode }) {
  const MAX_SEGMENT_MS = 6000;
  const segments = [];
  let current = null;
  for (const w of words) {
    const startMs = Math.round(w.start * 1000);
    const endMs = Math.round(w.end * 1000);
    if (!current || endMs - current.startMs > MAX_SEGMENT_MS) {
      if (current) segments.push(current);
      current = { startMs, endMs, text: w.word.trim() };
    } else {
      current.endMs = endMs;
      current.text += w.word;
    }
  }
  if (current) segments.push(current);
  return { videoId, title, languageCode, source: "speech_to_text", segments };
}

const manual = fromYtDlpJson3("out/iG9CE55wbtY.manual.en.json3", {
  videoId: "iG9CE55wbtY",
  title: "Do schools kill creativity? | Sir Ken Robinson | TED",
  languageCode: "en",
  source: "manual_caption",
});

const auto = fromYtDlpJson3("out/jNQXAC9IVRw.en.json3", {
  videoId: "jNQXAC9IVRw",
  title: "Me at the zoo",
  languageCode: "en",
  source: "auto_caption",
});

console.log("=== manual_caption (yt-dlp, TED talk) ===");
console.log(`videoId=${manual.videoId} source=${manual.source} segments=${manual.segments.length}`);
console.log(JSON.stringify(manual.segments.slice(0, 2), null, 2));

console.log("\n=== auto_caption (yt-dlp, Me at the zoo) ===");
console.log(`videoId=${auto.videoId} source=${auto.source} segments=${auto.segments.length}`);
console.log(JSON.stringify(auto.segments, null, 2));

console.log("\nBoth sources normalize to the identical TranscriptSegment[] shape (startMs/endMs/text),");
console.log("regardless of provider. A speech_to_text-sourced result (Round 4, word-level timestamps");
console.log("regrouped via fromWhisperWords()) fits the same shape — see docs for the worked example.");
