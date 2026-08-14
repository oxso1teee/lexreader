import test from "node:test";
import assert from "node:assert/strict";
import { parseTimestampToMs, buildSegmentsFromDomRows } from "./dom-transcript.mjs";

test("parseTimestampToMs handles M:SS", () => {
  assert.equal(parseTimestampToMs("0:01"), 1000);
  assert.equal(parseTimestampToMs("3:10"), 190000);
  assert.equal(parseTimestampToMs("12:34"), 754000);
});

test("parseTimestampToMs handles H:MM:SS", () => {
  assert.equal(parseTimestampToMs("1:02:03"), 3723000);
});

test("parseTimestampToMs rejects garbage without inventing a value", () => {
  assert.equal(parseTimestampToMs("not a timestamp"), null);
  assert.equal(parseTimestampToMs(""), null);
  assert.equal(parseTimestampToMs(undefined), null);
  assert.equal(parseTimestampToMs("1"), null);
  assert.equal(parseTimestampToMs("-1:00"), null);
});

test("buildSegmentsFromDomRows (real fixture): 'Me at the zoo' transcript panel rows produce the same 3 segments as the network capture", () => {
  const rows = [
    { timestampText: "0:01", text: "All right, so here we are, in front of the elephants the cool thing about these guys is that they have really..." },
    { timestampText: "0:07", text: "really really long trunks and that's cool (baaaaaaaaaaahhh!!)" },
    { timestampText: "0:16", text: "and that's pretty much all there is to say" },
  ];
  const segments = buildSegmentsFromDomRows(rows);
  assert.deepEqual(segments, [
    { startMs: 1000, endMs: 7000, text: "All right, so here we are, in front of the elephants the cool thing about these guys is that they have really..." },
    { startMs: 7000, endMs: 16000, text: "really really long trunks and that's cool (baaaaaaaaaaahhh!!)" },
    { startMs: 16000, endMs: 20000, text: "and that's pretty much all there is to say" },
  ]);
});

test("buildSegmentsFromDomRows drops rows with an unparseable timestamp or empty text, keeps the rest in order", () => {
  const rows = [
    { timestampText: "0:01", text: "first" },
    { timestampText: "garbage", text: "dropped: bad timestamp" },
    { timestampText: "0:05", text: "   " }, // whitespace-only text
    { timestampText: "0:10", text: "second" },
  ];
  const segments = buildSegmentsFromDomRows(rows);
  assert.deepEqual(segments.map((s) => s.text), ["first", "second"]);
});

test("buildSegmentsFromDomRows on an empty row list returns an empty array, never invents data", () => {
  assert.deepEqual(buildSegmentsFromDomRows([]), []);
  assert.deepEqual(buildSegmentsFromDomRows(undefined), []);
});

test("buildSegmentsFromDomRows: last segment gets a conservative fixed extension past its own start", () => {
  const segments = buildSegmentsFromDomRows([{ timestampText: "3:35", text: "last line" }]);
  assert.equal(segments[0].startMs, 215000);
  assert.equal(segments[0].endMs, 219000);
});
