import { Innertube } from "youtubei.js";

const videoId = process.argv[2] || "iG9CE55wbtY"; // Ken Robinson TED talk

console.log(`=== youtubei.js test: ${videoId} ===`);
const yt = await Innertube.create({ lang: "en", location: "US", retrieve_player: false });
console.log("Innertube client created.");

const info = await yt.getInfo(videoId);
console.log("title:", info.basic_info?.title);
console.log("duration (s):", info.basic_info?.duration);
console.log("channel:", info.basic_info?.channel?.name);

const tracks = info.captions?.caption_tracks ?? [];
console.log("caption tracks found:", tracks.length);
for (const t of tracks) {
  console.log(`  - lang=${t.language_code} name=${t.name?.text} kind=${t.kind ?? t.is_translatable ? "?" : "?"} vss=${t.vss_id}`);
}

if (tracks.length === 0) {
  console.log("RESULT: no caption tracks discovered.");
  process.exit(0);
}

// try the first English-ish track, else first
const track = tracks.find(t => t.language_code?.startsWith("en")) ?? tracks[0];
console.log("selected track lang:", track.language_code, "kind info:", JSON.stringify({ is_translatable: track.is_translatable }));

const transcriptInfo = await info.getTranscript();
const segments = transcriptInfo?.transcript?.content?.body?.initial_segments ?? [];
console.log("transcript segments found via getTranscript():", segments.length);
if (segments.length > 0) {
  console.log("first 3 segments:");
  for (const s of segments.slice(0, 3)) {
    console.log(`  start_ms=${s.start_ms} end_ms=${s.end_ms} text=${JSON.stringify(s.snippet?.text)}`);
  }
  console.log("last segment:", JSON.stringify({
    start_ms: segments[segments.length-1]?.start_ms,
    end_ms: segments[segments.length-1]?.end_ms,
    text: segments[segments.length-1]?.snippet?.text,
  }));
}
