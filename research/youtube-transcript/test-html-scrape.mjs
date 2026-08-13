import { fetchYoutubeTranscript, extractVideoId } from "../../browser-extension/youtube-transcript.mjs";

const CANDIDATES = [
  { id: "jNQXAC9IVRw", label: "Me at the zoo (first YT video, very short)" },
  { id: "iG9CE55wbtY", label: "Ken Robinson TED talk (long-form, likely manual captions)" },
  { id: "9bZkp7q19f0", label: "PSY - Gangnam Style (massively popular, multi-lang likely)" },
];

for (const c of CANDIDATES) {
  console.log(`\n=== ${c.label} (${c.id}) ===`);
  try {
    const result = await fetchYoutubeTranscript(`https://www.youtube.com/watch?v=${c.id}`, "en");
    console.log(`OK: title="${result.title}" lang=${result.languageCode} segments=${result.segments.length}`);
    console.log(`first segment: ${JSON.stringify(result.segments[0])}`);
    console.log(`last segment: ${JSON.stringify(result.segments[result.segments.length - 1])}`);
  } catch (err) {
    console.log(`FAILED: ${err.message}`);
  }
}
