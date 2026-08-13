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
console.log("tracks found:", tracks.length);
if (tracks.length === 0) { console.log("STOP: no tracks"); process.exit(0); }

const track = tracks[0];
console.log("track languageCode:", track.languageCode, "kind:", track.kind);
const captionUrl = new URL(track.baseUrl, "https://www.youtube.com");
captionUrl.searchParams.set("fmt", "json3");
console.log("fetching caption URL...");

const capRes = await fetch(captionUrl.toString(), {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
  },
});
console.log("caption fetch status:", capRes.status);
const body = await capRes.text();
console.log("caption body length:", body.length);
console.log("caption body first 300 chars:", body.slice(0, 300));
