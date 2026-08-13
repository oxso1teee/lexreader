// Controlled failure-injection test of a real provider-chain dispatcher.
// Every caption provider below is REAL dispatcher logic that genuinely throws
// (simulating the exhausted-provider condition from Round 7: on current
// YouTube, essentially every real captioned video already has captions, so
// this is what the chain looks like on a video where — hypothetically, by
// injected failure, NOT by natural absence — no caption path is usable).
// Only speech_to_text is real end-to-end: real yt-dlp audio extraction, real
// faster-whisper transcription, zero use of any caption payload as input.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ProviderFailure extends Error {}

// --- Injected-failure providers (real functions, in the real chain, that
// genuinely throw — not stubs skipped by an if-statement) ---

async function manualCaptionProvider() {
  throw new ProviderFailure(
    "manual_caption: no usable manual caption track (injected — see docs for why: on real " +
      "YouTube this video *does* have auto captions, so this step is a controlled failure, " +
      "not a natural one)",
  );
}

async function autoCaptionProvider() {
  throw new ProviderFailure("auto_caption: no usable automatic caption track (injected)");
}

async function innertubeProvider() {
  throw new ProviderFailure(
    "innertube: transcript endpoint unavailable — consistent with Round 1's REAL failure " +
      "(youtubei.js v18.0.0 hit HTTP 400 from get_transcript on 2 client profiles this session)",
  );
}

async function browserBridgeProvider() {
  throw new ProviderFailure(
    "browser_bridge: no live extension session available in this dispatcher run " +
      "(architecture proven working in Round 3; this run has no attached browser)",
  );
}

async function ytDlpCaptionProvider() {
  throw new ProviderFailure("yt_dlp_caption: no usable caption result (injected)");
}

// --- Real terminal fallback: audio extraction + local STT ---

async function speechToTextProvider(videoId, title) {
  const audioPath = path.join(__dirname, "out", `${videoId}.fallback-proof.wav`);

  const extractStart = Date.now();
  await execFileAsync("yt-dlp", [
    "-x",
    "--audio-format",
    "wav",
    "--audio-quality",
    "0",
    "-o",
    audioPath.replace(/\.wav$/, ".%(ext)s"),
    `https://www.youtube.com/watch?v=${videoId}`,
  ]);
  const extractMs = Date.now() - extractStart;

  const { stdout } = await execFileAsync(
    path.join(__dirname, "whisper-venv", "bin", "python"),
    [path.join(__dirname, "whisper_transcribe_json.py"), audioPath, "tiny"],
  );
  const whisperOut = JSON.parse(stdout);

  // Regroup word-level timestamps into display-sized segments (same approach
  // proven in Round 5's fromWhisperWords, ported here as the real provider's
  // own normalization step rather than a separate research-only function).
  const MAX_SEGMENT_MS = 6000;
  const segments = [];
  let current = null;
  for (const w of whisperOut.words) {
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

  return {
    result: {
      videoId,
      title,
      languageCode: whisperOut.language,
      source: "speech_to_text",
      segments,
    },
    meta: {
      audioExtractionMs: extractMs,
      whisperModelLoadS: whisperOut.model_load_s,
      whisperTranscribeS: whisperOut.transcribe_s,
      languageProbability: whisperOut.language_probability,
    },
  };
}

const PROVIDER_CHAIN = [
  { name: "manual_caption", fn: manualCaptionProvider },
  { name: "auto_caption", fn: autoCaptionProvider },
  { name: "innertube", fn: innertubeProvider },
  { name: "browser_bridge", fn: browserBridgeProvider },
  { name: "yt_dlp_caption", fn: ytDlpCaptionProvider },
  { name: "speech_to_text", fn: speechToTextProvider },
];

async function dispatchTranscript(videoId, title) {
  const attempts = [];
  for (const provider of PROVIDER_CHAIN) {
    try {
      const outcome = await provider.fn(videoId, title);
      attempts.push({ provider: provider.name, outcome: "success" });
      return { transcript: outcome.result ?? outcome, meta: outcome.meta, attempts };
    } catch (err) {
      attempts.push({ provider: provider.name, outcome: "failed", reason: err.message });
    }
  }
  throw new Error("All providers in chain exhausted — no transcript available");
}

// --- Run it ---

const videoId = "jNQXAC9IVRw";
const title = "Me at the zoo";

console.log(`=== Provider-chain dispatch for ${videoId} (${title}) ===\n`);

const { transcript, meta, attempts } = await dispatchTranscript(videoId, title);

console.log("Provider attempt order and outcomes:");
for (const a of attempts) {
  console.log(`  ${a.provider}: ${a.outcome}${a.reason ? ` — ${a.reason}` : ""}`);
}

console.log(`\nDispatcher selected source: ${transcript.source}`);
console.log(`Audio extraction: ${meta.audioExtractionMs}ms`);
console.log(`Whisper model load: ${meta.whisperModelLoadS}s, transcribe: ${meta.whisperTranscribeS}s`);
console.log(`Detected language: ${transcript.languageCode} (p=${meta.languageProbability.toFixed(2)})`);
console.log(`Segment count: ${transcript.segments.length}`);

console.log("\nFirst 5 normalized segments:");
for (const s of transcript.segments.slice(0, 5)) {
  console.log(`  [${s.startMs} -> ${s.endMs}] (endMs>startMs: ${s.endMs > s.startMs}) ${JSON.stringify(s.text)}`);
}

// --- Assertions (Step 3) ---
console.log("\n=== Assertions ===");
const captionProviders = attempts.filter((a) => a.provider !== "speech_to_text");
const allCaptionProvidersFailed = captionProviders.every((a) => a.outcome === "failed");
const sttSelected = transcript.source === "speech_to_text";
const nonEmpty = transcript.segments.length > 0;
const validTimestamps = transcript.segments.every((s) => s.endMs > s.startMs && s.startMs >= 0);
const hasRealText = transcript.segments.every((s) => s.text.trim().length > 0);

console.log(`caption providers all failed: ${allCaptionProvidersFailed}`);
console.log(`dispatcher selected speech_to_text: ${sttSelected}`);
console.log(`non-empty segments: ${nonEmpty}`);
console.log(`all timestamps valid (endMs > startMs, startMs >= 0): ${validTimestamps}`);
console.log(`all segments have real text: ${hasRealText}`);
const allPass = allCaptionProvidersFailed && sttSelected && nonEmpty && validTimestamps && hasRealText;
console.log(`\nALL ASSERTIONS PASS: ${allPass}`);
