import { extractCaptionTracks } from "../../browser-extension/youtube-transcript.mjs";

const videoId = "9bZkp7q19f0";
const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    Cookie: "CONSENT=YES+cb",
  },
});
const html = await res.text();

const tracks = extractCaptionTracks(html);
console.log("extractCaptionTracks() result count:", tracks.length);

// find the raw region around captionTracks manually
const idx = html.indexOf('"captionTracks"');
console.log("first captionTracks index:", idx);
console.log("context:", html.slice(idx, idx + 400));

// count occurrences
let count = 0, pos = 0;
while ((pos = html.indexOf('"captionTracks"', pos)) !== -1) { count++; pos += 1; }
console.log("total occurrences of captionTracks key:", count);
