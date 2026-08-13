import { Innertube, ClientType } from "youtubei.js";

const videoId = "iG9CE55wbtY";
console.log(`=== youtubei.js iOS client test: ${videoId} ===`);

const yt = await Innertube.create({ lang: "en", location: "US", client_type: ClientType.IOS });
const info = await yt.getInfo(videoId);
console.log("title:", info.basic_info?.title);
console.log("captions object keys:", Object.keys(info.captions ?? {}));
const tracks = info.captions?.caption_tracks ?? [];
console.log("caption_tracks length:", tracks.length);
for (const t of tracks.slice(0, 10)) {
  console.log(`  lang=${t.language_code} name=${t.name?.text} vss=${t.vss_id} is_translatable=${t.is_translatable}`);
}

if (tracks.length > 0) {
  const track = tracks.find(t => t.language_code === "en") ?? tracks[0];
  console.log("fetching caption content for:", track.language_code, track.base_url?.slice(0,120));
  try {
    const capRes = await fetch(track.base_url);
    const body = await capRes.text();
    console.log("caption fetch status:", capRes.status, "body length:", body.length);
    if (body.length > 0) console.log("snippet:", body.slice(0, 300));
  } catch (e) {
    console.log("caption fetch error:", e.message);
  }
}
