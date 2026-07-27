import test from "node:test";
import assert from "node:assert/strict";
import {
  extractCaptionTracks,
  extractVideoId,
  fetchYoutubeTranscript,
  parseJson3Segments,
} from "./youtube-transcript.mjs";

test("extractVideoId supports normal, short and Shorts URLs", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=abcDEF_123-"), "abcDEF_123-");
  assert.equal(extractVideoId("https://youtu.be/abcDEF_123-?t=10"), "abcDEF_123-");
  assert.equal(extractVideoId("https://youtube.com/shorts/abcDEF_123-"), "abcDEF_123-");
  assert.equal(extractVideoId("https://example.com/watch?v=abcDEF_123-"), null);
});

test("extractCaptionTracks reads nested JSON without stopping on nested objects", () => {
  const html = String.raw`<script>{"captions":{"playerCaptionsTracklistRenderer":{"captionTracks":[{"baseUrl":"https://www.youtube.com/api/timedtext?v=x\u0026lang=en","name":{"simpleText":"English"},"languageCode":"en"}]}},"videoDetails":{"title":"Demo"}}</script>`;
  const tracks = extractCaptionTracks(html);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].languageCode, "en");
  assert.match(tracks[0].baseUrl, /lang=en/);
});

test("parseJson3Segments combines fragments and fills a missing duration", () => {
  const segments = parseJson3Segments({
    events: [
      { tStartMs: 0, dDurationMs: 1_500, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
      { tStartMs: 1_500, segs: [{ utf8: "Next line" }] },
    ],
  });
  assert.deepEqual(segments, [
    { startMs: 0, endMs: 1_500, body: "Hello world" },
    { startMs: 1_500, endMs: 3_500, body: "Next line" },
  ]);
});

test("fetchYoutubeTranscript chooses the learning-language track", async () => {
  const html = String.raw`
    <meta name="title" content="Test &amp; Learn">
    <script>
      {"captionTracks":[
        {"baseUrl":"https://www.youtube.com/api/timedtext?v=video1&lang=ru","languageCode":"ru"},
        {"baseUrl":"https://www.youtube.com/api/timedtext?v=video1&lang=en","languageCode":"en"}
      ],"videoDetails":{"title":"Test & Learn"}}
    </script>
  `;
  const json3 = JSON.stringify({
    events: [{ tStartMs: 100, dDurationMs: 900, segs: [{ utf8: "Welcome" }] }],
  });
  const requestedUrls = [];
  const mockFetch = async (url) => {
    requestedUrls.push(String(url));
    return requestedUrls.length === 1
      ? new Response(html, { status: 200 })
      : new Response(json3, { status: 200 });
  };

  const result = await fetchYoutubeTranscript(
    "https://www.youtube.com/watch?v=video1",
    "en",
    mockFetch,
  );
  assert.equal(result.languageCode, "en");
  assert.equal(result.title, "Test & Learn");
  assert.deepEqual(result.segments, [{ startMs: 100, endMs: 1_000, body: "Welcome" }]);
  assert.match(requestedUrls[1], /lang=en/);
  assert.match(requestedUrls[1], /fmt=json3/);
});
