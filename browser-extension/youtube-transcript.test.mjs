import test from "node:test";
import assert from "node:assert/strict";
import { extractVideoId, parseJson3Segments, buildTranscriptResult } from "./youtube-transcript.mjs";

test("extractVideoId supports normal, short and Shorts URLs", () => {
  assert.equal(extractVideoId("https://www.youtube.com/watch?v=abcDEF_123-"), "abcDEF_123-");
  assert.equal(extractVideoId("https://youtu.be/abcDEF_123-?t=10"), "abcDEF_123-");
  assert.equal(extractVideoId("https://youtube.com/shorts/abcDEF_123-"), "abcDEF_123-");
  assert.equal(extractVideoId("https://example.com/watch?v=abcDEF_123-"), null);
});

test("extractVideoId ignores the #lexreader-extraction marker background.mjs appends to created tabs (RC extraction bug)", () => {
  assert.equal(
    extractVideoId("https://www.youtube.com/watch?v=abcDEF_123-#lexreader-extraction"),
    "abcDEF_123-",
  );
});

test("parseJson3Segments combines fragments and fills a missing duration", () => {
  const segments = parseJson3Segments({
    events: [
      { tStartMs: 0, dDurationMs: 1_500, segs: [{ utf8: "Hello " }, { utf8: "world" }] },
      { tStartMs: 1_500, segs: [{ utf8: "Next line" }] },
    ],
  });
  assert.deepEqual(segments, [
    { startMs: 0, endMs: 1_500, text: "Hello world" },
    { startMs: 1_500, endMs: 3_500, text: "Next line" },
  ]);
});

test("parseJson3Segments drops events with no usable text or a negative start", () => {
  const segments = parseJson3Segments({
    events: [
      { tStartMs: 0, segs: [{ utf8: "   " }] },
      { tStartMs: -10, segs: [{ utf8: "invalid" }] },
      { tStartMs: 100, segs: [{ utf8: "kept" }] },
    ],
  });
  assert.deepEqual(segments, [{ startMs: 100, endMs: 2_100, text: "kept" }]);
});

test("buildTranscriptResult produces the canonical shape from a real-shaped captured payload", () => {
  const bodyText = JSON.stringify({
    events: [
      { tStartMs: 1_200, dDurationMs: 2_160, segs: [{ utf8: "All right, so here we are" }] },
      { tStartMs: 3_360, dDurationMs: 1_500, segs: [{ utf8: "in front of the elephants" }] },
    ],
  });

  const result = buildTranscriptResult({
    videoId: "jNQXAC9IVRw",
    title: "Me at the zoo",
    lengthSeconds: "19",
    lang: "en",
    kind: null,
    bodyText,
  });

  assert.equal(result.videoId, "jNQXAC9IVRw");
  assert.equal(result.title, "Me at the zoo");
  assert.equal(result.languageCode, "en");
  assert.equal(result.durationMs, 19_000);
  assert.equal(result.source, "manual_caption");
  assert.deepEqual(result.segments, [
    { startMs: 1_200, endMs: 3_360, text: "All right, so here we are" },
    { startMs: 3_360, endMs: 4_860, text: "in front of the elephants" },
  ]);
});

test("buildTranscriptResult tags auto-generated captions (kind=asr) as auto_caption", () => {
  const bodyText = JSON.stringify({
    events: [{ tStartMs: 0, dDurationMs: 1_000, segs: [{ utf8: "auto captioned" }] }],
  });
  const result = buildTranscriptResult({
    videoId: "abcDEF_123-",
    title: "Auto captions",
    lengthSeconds: "10",
    lang: "en",
    kind: "asr",
    bodyText,
  });
  assert.equal(result.source, "auto_caption");
});

test("buildTranscriptResult rejects a malformed video ID", () => {
  assert.throws(() =>
    buildTranscriptResult({ videoId: "; rm -rf /", title: "x", lengthSeconds: "1", lang: "en", kind: null, bodyText: "{}" }),
  );
});

test("buildTranscriptResult rejects unparseable JSON", () => {
  assert.throws(() =>
    buildTranscriptResult({ videoId: "abcDEF_123-", title: "x", lengthSeconds: "1", lang: "en", kind: null, bodyText: "not json" }),
  );
});

test("buildTranscriptResult rejects an empty transcript rather than saving zero segments", () => {
  assert.throws(() =>
    buildTranscriptResult({
      videoId: "abcDEF_123-",
      title: "x",
      lengthSeconds: "1",
      lang: "en",
      kind: null,
      bodyText: JSON.stringify({ events: [] }),
    }),
  );
});

test("buildTranscriptResult falls back to a placeholder title when none was captured", () => {
  const result = buildTranscriptResult({
    videoId: "abcDEF_123-",
    title: undefined,
    lengthSeconds: undefined,
    lang: "en",
    kind: null,
    bodyText: JSON.stringify({ events: [{ tStartMs: 0, dDurationMs: 1_000, segs: [{ utf8: "hi" }] }] }),
  });
  assert.equal(result.title, "YouTube abcDEF_123-");
  assert.equal(result.durationMs, undefined);
});
