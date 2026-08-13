import { extractCaptionTracks } from "../../browser-extension/youtube-transcript.mjs";

const videoId = "9bZkp7q19f0";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
  headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+cb" },
});
const html = await res.text();
const tracks = extractCaptionTracks(html);
const track = tracks[0];
console.log("base track url:", track.baseUrl.slice(0, 150));

async function tryFetch(label, url, headers) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    const body = await r.text();
    console.log(`[${label}] status=${r.status} bodyLen=${body.length} snippet=${JSON.stringify(body.slice(0,150))}`);
  } catch (e) {
    console.log(`[${label}] ERROR: ${e.message}`);
  }
}

// Variant 1: raw baseUrl, no fmt param, no extra headers
await tryFetch("raw-no-headers", track.baseUrl, {});

// Variant 2: raw baseUrl with UA
await tryFetch("raw-with-UA", track.baseUrl, { "User-Agent": UA });

// Variant 3: fmt=json3 with UA + Referer + Origin
const withJson3 = new URL(track.baseUrl);
withJson3.searchParams.set("fmt", "json3");
await tryFetch("json3-UA-Referer", withJson3.toString(), {
  "User-Agent": UA,
  "Referer": `https://www.youtube.com/watch?v=${videoId}`,
  "Origin": "https://www.youtube.com",
});

// Variant 4: fmt=srv3
const withSrv3 = new URL(track.baseUrl);
withSrv3.searchParams.set("fmt", "srv3");
await tryFetch("srv3-UA", withSrv3.toString(), { "User-Agent": UA });

// Variant 5: fmt=vtt
const withVtt = new URL(track.baseUrl);
withVtt.searchParams.set("fmt", "vtt");
await tryFetch("vtt-UA", withVtt.toString(), { "User-Agent": UA });
