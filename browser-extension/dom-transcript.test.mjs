import test from "node:test";
import assert from "node:assert/strict";

await import("./youtube-dom-extractor.js");
const {
  parseTimestampToMs,
  createAccumulator,
  assessTranscriptCompleteness,
  collectVirtualizedTranscript,
} = globalThis.LexReaderYoutubeDomExtractor;

function row(timestampText, text) {
  return { timestampText, text };
}

function formatTimestamp(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function createVirtualAdapter(rows, { rowHeight = 100, clientHeight = 300, stuck = false } = {}) {
  let scrollTop = 0;
  const scrollHeight = Math.max(clientHeight, rows.length * rowHeight);
  return {
    readRows() {
      const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 1);
      const count = Math.ceil(clientHeight / rowHeight) + 2;
      return rows.slice(start, start + count);
    },
    getScrollState() {
      return { scrollTop, scrollHeight, clientHeight };
    },
    async scrollAndWait(nextTop) {
      if (!stuck) scrollTop = Math.min(Math.max(0, nextTop), scrollHeight - clientHeight);
      return !stuck;
    },
    async waitForProgress() {
      return false;
    },
  };
}

test("DOM parsing: mm:ss and hh:mm:ss timestamps are accepted", () => {
  assert.equal(parseTimestampToMs("0:01"), 1_000);
  assert.equal(parseTimestampToMs("12:34"), 754_000);
  assert.equal(parseTimestampToMs("1:02:03"), 3_723_000);
});

test("DOM parsing: malformed timestamps are rejected", () => {
  for (const value of [undefined, "", "1", "-1:00", "1:60", "1:02:99", "not a timestamp"]) {
    assert.equal(parseTimestampToMs(value), null, String(value));
  }
});

test("DOM parsing: one row produces one canonical segment with a bounded final end", () => {
  const accumulator = createAccumulator();
  accumulator.addRows([row("3:35", "  one\u00a0 row  ")]);
  assert.deepEqual(accumulator.toSegments(), [
    { startMs: 215_000, endMs: 219_000, text: "one row" },
  ]);
});

test("DOM parsing: many rows are ordered, empty/malformed rows dropped, and endMs derives from the next start", () => {
  const accumulator = createAccumulator();
  accumulator.addRows([
    row("0:10", "third"),
    row("garbage", "drop"),
    row("0:01", "first &amp; clean"),
    row("0:05", "   "),
    row("0:06", "second"),
  ]);
  assert.deepEqual(accumulator.toSegments(), [
    { startMs: 1_000, endMs: 6_000, text: "first & clean" },
    { startMs: 6_000, endMs: 10_000, text: "second" },
    { startMs: 10_000, endMs: 14_000, text: "third" },
  ]);
  assert.equal(accumulator.malformedRowsDiscarded, 2);
});

test("DOM parsing: duplicate rows use timestamp + normalized text as the unique key", () => {
  const accumulator = createAccumulator();
  accumulator.addRows([
    row("0:01", "same line"),
    row("0:01", "same   line"),
    row("0:01", "different line at same timestamp"),
  ]);
  assert.equal(accumulator.uniqueSegments, 2);
  assert.equal(accumulator.duplicatesDiscarded, 1);
});

test("virtualization: new rows mounted after each scroll are accumulated across the full panel", async () => {
  const rows = Array.from({ length: 40 }, (_, index) => row(formatTimestamp(index * 3), `line ${index}`));
  const result = await collectVirtualizedTranscript({
    adapter: createVirtualAdapter(rows),
    durationMs: 120_000,
  });
  assert.equal(result.metrics.uniqueSegments, 40);
  assert.equal(result.segments[0].text, "line 0");
  assert.equal(result.segments.at(-1).text, "line 39");
  assert.ok(result.metrics.scrollIterations > 5, "long panel must exercise multiple scroll steps");
  assert.equal(result.metrics.completeness.complete, true);
});

test("virtualization: repeatedly mounted overlap is deduplicated and stable bottom terminates", async () => {
  const rows = Array.from({ length: 20 }, (_, index) => row(formatTimestamp(index * 4), `line ${index}`));
  const result = await collectVirtualizedTranscript({
    adapter: createVirtualAdapter(rows, { clientHeight: 400 }),
    durationMs: 80_000,
  });
  assert.equal(result.metrics.uniqueSegments, 20);
  assert.ok(result.metrics.duplicatesDiscarded > 0);
  assert.equal(result.metrics.exhausted, true);
  assert.ok(result.metrics.scrollIterations < 100, "stable bottom must be bounded");
});

test("virtualization: a stuck scroll container terminates without an unbounded loop", async () => {
  const rows = [row("0:01", "only mounted row")];
  const result = await collectVirtualizedTranscript({
    adapter: createVirtualAdapter(rows, { stuck: true }),
    durationMs: 7_000_000,
  });
  assert.equal(result.metrics.uniqueSegments, 1);
  assert.equal(result.metrics.completeness.complete, false);
  assert.equal(result.metrics.completeness.reason, "too_few_segments_for_duration");
  assert.ok(result.metrics.scrollIterations <= 8, "each pass needs one collection iteration plus the stable-iteration bound");
});

test("virtualization: an incomplete first pass retries and the second pass can complete", async () => {
  const shortRows = Array.from({ length: 4 }, (_, index) => row(formatTimestamp(index * 60), `early ${index}`));
  const fullRows = Array.from({ length: 70 }, (_, index) => row(formatTimestamp(index * 100), `full ${index}`));
  let pass = 0;
  let delegate = createVirtualAdapter(shortRows);
  const adapter = {
    readRows: () => delegate.readRows(),
    getScrollState: () => delegate.getScrollState(),
    async scrollAndWait(nextTop) {
      if (nextTop === 0) {
        pass += 1;
        delegate = createVirtualAdapter(pass >= 2 ? fullRows : shortRows);
      }
      return await delegate.scrollAndWait(nextTop);
    },
    waitForProgress: () => delegate.waitForProgress(),
  };

  const result = await collectVirtualizedTranscript({ adapter, durationMs: 7_000_000 });
  assert.equal(result.metrics.collectionPasses, 2);
  assert.equal(result.metrics.uniqueSegments, 74);
  assert.equal(result.metrics.completeness.complete, true);
  assert.equal(result.metrics.completeness.reason, "near_video_end");
});

test("completeness: a long video ending at minute 3 is rejected", () => {
  const segments = Array.from({ length: 30 }, (_, index) => ({
    startMs: index * 6_000,
    endMs: index * 6_000 + 6_000,
    text: `line ${index}`,
  }));
  const result = assessTranscriptCompleteness(segments, 116 * 60_000, true);
  assert.equal(result.complete, false);
  assert.equal(result.reason, "too_few_segments_for_duration");
});

test("completeness: a long transcript plausibly near the video end is accepted", () => {
  const segments = Array.from({ length: 70 }, (_, index) => ({
    startMs: index * 100_000,
    endMs: index * 100_000 + 4_000,
    text: `line ${index}`,
  }));
  const result = assessTranscriptCompleteness(segments, 7_000_000, true);
  assert.equal(result.complete, true);
  assert.equal(result.reason, "near_video_end");
});
