import test from "node:test";
import assert from "node:assert/strict";
import { serializedJsonBytes, transcriptDiagnosticMetadata } from "./diagnostics.ts";

test("transcript diagnostics report metadata and UTF-8 serialized bytes without transcript text", () => {
  const transcript = {
    videoId: "PolmvqSxnbc",
    title: "Robinson Crusoe",
    languageCode: "en",
    durationMs: 6_993_000,
    source: "browser_bridge" as const,
    segments: Array.from({ length: 973 }, (_, index) => ({
      startMs: index * 7_000,
      endMs: index * 7_000 + 7_000,
      text: `caption ${index}`,
    })),
  };

  const metadata = transcriptDiagnosticMetadata(transcript);
  assert.equal(metadata.videoId, "PolmvqSxnbc");
  assert.equal(metadata.segmentCount, 973);
  assert.equal(metadata.durationSeconds, 6_993);
  assert.equal(metadata.source, "browser_bridge");
  assert.equal(metadata.serializedPayloadBytes, Buffer.byteLength(JSON.stringify(transcript), "utf8"));
  assert.equal("segments" in metadata, false, "diagnostics must never contain the transcript rows");
});

test("serializedJsonBytes measures UTF-8 rather than JavaScript code units", () => {
  const value = { text: "Привет" };
  assert.equal(serializedJsonBytes(value), Buffer.byteLength(JSON.stringify(value), "utf8"));
});
