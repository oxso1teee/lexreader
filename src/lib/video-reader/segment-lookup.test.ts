import { test } from "node:test";
import assert from "node:assert/strict";
import { findActiveSegmentIndex, clampResumeIndex, formatTimestamp } from "./segment-lookup.ts";

const segments = [
  { startMs: 0, endMs: 1000 },
  { startMs: 1000, endMs: 2500 },
  { startMs: 2500, endMs: 4000 },
  { startMs: 4000, endMs: 6000 },
  { startMs: 6000, endMs: 8000 },
];

test("findActiveSegmentIndex: exact segment start", () => {
  assert.equal(findActiveSegmentIndex(segments, 2500, 0), 2);
});

test("findActiveSegmentIndex: mid-segment time", () => {
  assert.equal(findActiveSegmentIndex(segments, 1800, 0), 1);
});

test("findActiveSegmentIndex: last segment, time past its end (video still playing)", () => {
  assert.equal(findActiveSegmentIndex(segments, 9000, 0), 4);
});

test("findActiveSegmentIndex: time before the first segment starts falls back", () => {
  assert.equal(findActiveSegmentIndex(segments, 0, 0), 0);
  assert.equal(findActiveSegmentIndex(segments, -500, 2), 2);
});

test("findActiveSegmentIndex: empty segments returns fallback", () => {
  assert.equal(findActiveSegmentIndex([], 5000, 3), 3);
});

test("findActiveSegmentIndex: boundary exactly at a segment's endMs picks the next segment", () => {
  // endMs of segments[1] equals startMs of segments[2] — the shared instant belongs to the next one.
  assert.equal(findActiveSegmentIndex(segments, 2500, 0), 2);
});

test("findActiveSegmentIndex: gap between segments keeps highlighting the last-started one", () => {
  const withGap = [
    { startMs: 0, endMs: 1000 },
    { startMs: 5000, endMs: 6000 },
  ];
  assert.equal(findActiveSegmentIndex(withGap, 3000, 0), 0);
});

test("findActiveSegmentIndex: malformed timing (endMs <= startMs) never throws or misbehaves", () => {
  const malformed = [
    { startMs: 0, endMs: 0 },
    { startMs: 1000, endMs: 500 },
    { startMs: 2000, endMs: 3000 },
  ];
  assert.equal(findActiveSegmentIndex(malformed, 1500, 0), 1);
  assert.equal(findActiveSegmentIndex(malformed, 2500, 0), 2);
});

test("findActiveSegmentIndex: single-segment transcript", () => {
  const one = [{ startMs: 100, endMs: 200 }];
  assert.equal(findActiveSegmentIndex(one, 50, 0), 0);
  assert.equal(findActiveSegmentIndex(one, 150, 0), 0);
  assert.equal(findActiveSegmentIndex(one, 9999, 0), 0);
});

test("clampResumeIndex: null/undefined defaults to 0", () => {
  assert.equal(clampResumeIndex(null, 10), 0);
  assert.equal(clampResumeIndex(undefined, 10), 0);
});

test("clampResumeIndex: negative or out-of-range index clamps into bounds", () => {
  assert.equal(clampResumeIndex(-5, 10), 0);
  assert.equal(clampResumeIndex(999, 10), 9);
});

test("clampResumeIndex: zero segments always returns 0", () => {
  assert.equal(clampResumeIndex(5, 0), 0);
});

test("clampResumeIndex: valid index passes through unchanged", () => {
  assert.equal(clampResumeIndex(4, 10), 4);
});

test("formatTimestamp: zero and sub-minute", () => {
  assert.equal(formatTimestamp(0), "0:00");
  assert.equal(formatTimestamp(7000), "0:07");
  assert.equal(formatTimestamp(59_000), "0:59");
});

test("formatTimestamp: minutes boundary", () => {
  assert.equal(formatTimestamp(60_000), "1:00");
  assert.equal(formatTimestamp(723_000), "12:03");
});

test("formatTimestamp: hours boundary", () => {
  assert.equal(formatTimestamp(3_600_000), "1:00:00");
  assert.equal(formatTimestamp(3_862_000), "1:04:22");
});

test("formatTimestamp: negative/non-finite never throws", () => {
  assert.equal(formatTimestamp(-500), "0:00");
  assert.equal(formatTimestamp(NaN), "0:00");
});
