const videoId = "9bZkp7q19f0";
const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    Cookie: "CONSENT=YES+cb",
  },
});
console.log("status:", res.status);
const html = await res.text();
console.log("html length:", html.length);
console.log("contains 'captionTracks':", html.includes("captionTracks"));
console.log("contains 'playerCaptionsTracklistRenderer':", html.includes("playerCaptionsTracklistRenderer"));
console.log("contains 'ytInitialPlayerResponse':", html.includes("ytInitialPlayerResponse"));
console.log("contains consent/recaptcha markers:", html.includes("consent.youtube.com") || html.includes("g-recaptcha"));
console.log("title tag snippet:", html.match(/<title>([^<]*)<\/title>/)?.[1]);
console.log("first 500 chars:", html.slice(0, 500));
