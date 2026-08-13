import { Innertube } from "youtubei.js";

const videoId = process.argv[2] || "iG9CE55wbtY";
console.log(`=== youtubei.js getTranscript() test: ${videoId} ===`);

const yt = await Innertube.create({ lang: "en", location: "US", retrieve_player: false });
const info = await yt.getInfo(videoId);
console.log("title:", info.basic_info?.title);
console.log("has_transcript flag / captions object keys:", Object.keys(info.captions ?? {}));

try {
  const transcriptData = await info.getTranscript();
  console.log("getTranscript() succeeded. top-level keys:", Object.keys(transcriptData ?? {}));
  const body = transcriptData?.transcript?.content?.body;
  console.log("body keys:", body ? Object.keys(body) : null);
  const segments = body?.initial_segments ?? [];
  console.log("segment count:", segments.length);
  for (const s of segments.slice(0, 3)) {
    console.log("  seg:", JSON.stringify({ start_ms: s.start_ms, end_ms: s.end_ms, text: s.snippet?.text ?? s.snippet?.toString?.() }));
  }
} catch (err) {
  console.log("getTranscript() FAILED:", err?.message ?? err);
  console.log("stack:", err?.stack?.split("\n").slice(0,5).join("\n"));
}
