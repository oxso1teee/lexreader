import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSegments, normalizeTranscriptResult, TranscriptTooLargeError } from "../src/normalize.mjs";
import { MAX_SEGMENTS } from "../src/limits.mjs";

test("sorts segments ascending by startMs", () => {
  const out = normalizeSegments([
    { startMs: 2000, endMs: 3000, text: "second" },
    { startMs: 0, endMs: 1000, text: "first" },
  ]);
  assert.deepEqual(out.map((s) => s.text), ["first", "second"]);
});

test("drops segments with negative startMs", () => {
  const out = normalizeSegments([{ startMs: -100, endMs: 500, text: "bad" }]);
  assert.equal(out.length, 0);
});

test("drops segments where endMs <= startMs", () => {
  const out = normalizeSegments([
    { startMs: 1000, endMs: 1000, text: "zero-length" },
    { startMs: 2000, endMs: 1900, text: "inverted" },
  ]);
  assert.equal(out.length, 0);
});

test("drops empty-text segments after whitespace trim", () => {
  const out = normalizeSegments([{ startMs: 0, endMs: 500, text: "   \n\t  " }]);
  assert.equal(out.length, 0);
});

test("normalizes internal whitespace", () => {
  const out = normalizeSegments([{ startMs: 0, endMs: 500, text: "hello\n\nworld   again" }]);
  assert.equal(out[0].text, "hello world again");
});

test("merges pathologically tiny fragments into the following segment", () => {
  const out = normalizeSegments([
    { startMs: 0, endMs: 100, text: "tiny" }, // 100ms, under MIN_SEGMENT_MS, adjacent to next
    { startMs: 100, endMs: 2000, text: "rest" },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].text, "tiny rest");
  assert.equal(out[0].startMs, 0);
  assert.equal(out[0].endMs, 2000);
});

test("keeps well-formed segments untouched", () => {
  const input = [
    { startMs: 0, endMs: 3000, text: "All right so here we are" },
    { startMs: 3000, endMs: 6000, text: "the cool thing" },
  ];
  const out = normalizeSegments(input);
  assert.deepEqual(out, input);
});

test("real endMs > startMs invariant holds for every output segment", () => {
  const out = normalizeSegments([
    { startMs: 0, endMs: 1000, text: "a" },
    { startMs: 1000, endMs: 2000, text: "b" },
    { startMs: 2000, endMs: 2000, text: "dropped" },
  ]);
  for (const s of out) assert.ok(s.endMs > s.startMs);
});

test("throws TranscriptTooLargeError when segment count exceeds the cap", () => {
  const many = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => ({
    startMs: i * 10,
    endMs: i * 10 + 5,
    text: "x",
  }));
  assert.throws(() => normalizeSegments(many), TranscriptTooLargeError);
});

test("normalizeTranscriptResult fills a fallback title and 'und' language when missing", () => {
  const out = normalizeTranscriptResult({
    videoId: "abc123XYZ",
    title: "",
    languageCode: "",
    source: "yt_dlp_caption",
    segments: [{ startMs: 0, endMs: 1000, text: "hi" }],
  });
  assert.equal(out.title, "YouTube abc123XYZ");
  assert.equal(out.languageCode, "und");
  assert.equal(out.source, "yt_dlp_caption");
  assert.equal(out.segments.length, 1);
});
