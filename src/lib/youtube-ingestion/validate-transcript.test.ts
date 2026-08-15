import test from "node:test";
import assert from "node:assert/strict";
import { assertValidTranscriptResult, MalformedTranscriptError } from "./validate-transcript.ts";

const VALID = {
  videoId: "jNQXAC9IVRw",
  title: "Me at the zoo",
  languageCode: "en",
  durationMs: 19_000,
  source: "manual_caption",
  segments: [
    { startMs: 0, endMs: 1_000, text: "hello" },
    { startMs: 1_000, endMs: 2_000, text: "world" },
  ],
};

test("accepts a well-formed transcript", () => {
  assert.doesNotThrow(() => assertValidTranscriptResult(VALID));
});

test("rejects a non-object", () => {
  assert.throws(() => assertValidTranscriptResult(null), MalformedTranscriptError);
  assert.throws(() => assertValidTranscriptResult("a string"), MalformedTranscriptError);
});

test("rejects a missing videoId/title/languageCode", () => {
  assert.throws(() => assertValidTranscriptResult({ ...VALID, videoId: undefined }), MalformedTranscriptError);
  assert.throws(() => assertValidTranscriptResult({ ...VALID, title: "" }), MalformedTranscriptError);
  assert.throws(() => assertValidTranscriptResult({ ...VALID, languageCode: undefined }), MalformedTranscriptError);
});

test("rejects zero segments rather than saving an empty transcript", () => {
  assert.throws(() => assertValidTranscriptResult({ ...VALID, segments: [] }), MalformedTranscriptError);
});

test("rejects a segment with an inverted or missing timestamp", () => {
  assert.throws(
    () => assertValidTranscriptResult({ ...VALID, segments: [{ startMs: 1_000, endMs: 500, text: "bad" }] }),
    MalformedTranscriptError,
  );
  assert.throws(
    () => assertValidTranscriptResult({ ...VALID, segments: [{ startMs: -1, endMs: 500, text: "bad" }] }),
    MalformedTranscriptError,
  );
});

test("rejects a segment with empty text", () => {
  assert.throws(
    () => assertValidTranscriptResult({ ...VALID, segments: [{ startMs: 0, endMs: 500, text: "   " }] }),
    MalformedTranscriptError,
  );
});

test("rejects segments that are not in ascending start order", () => {
  assert.throws(
    () =>
      assertValidTranscriptResult({
        ...VALID,
        segments: [
          { startMs: 2_000, endMs: 3_000, text: "second" },
          { startMs: 1_000, endMs: 1_500, text: "first" },
        ],
      }),
    MalformedTranscriptError,
  );
});

test("accepts every real TranscriptSource value observed from the browser bridge", () => {
  for (const source of ["manual_caption", "auto_caption", "innertube", "browser_bridge", "yt_dlp_caption", "speech_to_text"]) {
    assert.doesNotThrow(() => assertValidTranscriptResult({ ...VALID, source }));
  }
});

test("rejects an unrecognized source so it cannot bypass the source-specific duration rule", () => {
  assert.throws(
    () => assertValidTranscriptResult({ ...VALID, source: "browser" }),
    MalformedTranscriptError,
  );
});

test("duration is milliseconds and must be a positive finite value when present", () => {
  assert.doesNotThrow(() => assertValidTranscriptResult({ ...VALID, durationMs: 6_993_000 }));
  assert.throws(() => assertValidTranscriptResult({ ...VALID, durationMs: 0 }), MalformedTranscriptError);
  assert.throws(() => assertValidTranscriptResult({ ...VALID, durationMs: Number.NaN }), MalformedTranscriptError);
});
