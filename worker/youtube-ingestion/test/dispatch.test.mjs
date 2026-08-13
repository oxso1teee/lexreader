import test from "node:test";
import assert from "node:assert/strict";
import { dispatchTranscript } from "../src/dispatch.mjs";
import { ProviderFailure, IngestionError, ErrorCategory } from "../src/errors.mjs";

const BASE_META = { title: "Test video", durationSeconds: 60 };
const VALID_ID = "abcDEF_123-";

function okResult(source) {
  return {
    videoId: VALID_ID,
    title: "Test video",
    languageCode: "en",
    durationMs: 60_000,
    source,
    segments: [{ startMs: 0, endMs: 1000, text: "hello world" }],
  };
}

test("falls back yt_dlp_caption -> innertube -> speech_to_text when each fails in turn", async () => {
  const attempted = [];
  const { transcript, attempts } = await dispatchTranscript(
    { videoId: VALID_ID, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
    {
      fetchMetadataFn: async () => BASE_META,
      ytDlpCaptionFn: async () => {
        attempted.push("yt_dlp_caption");
        throw new ProviderFailure("yt_dlp_caption", ErrorCategory.CAPTIONS_FAILED, "no captions");
      },
      innertubeFn: async () => {
        attempted.push("innertube");
        throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "no transcript");
      },
      speechToTextFn: async () => {
        attempted.push("speech_to_text");
        return okResult("speech_to_text");
      },
    },
  );

  assert.deepEqual(attempted, ["yt_dlp_caption", "innertube", "speech_to_text"]);
  assert.equal(transcript.source, "speech_to_text");
  assert.equal(attempts.length, 3);
  assert.equal(attempts[0].outcome, "failed");
  assert.equal(attempts[1].outcome, "failed");
  assert.equal(attempts[2].outcome, "success");
});

test("stops at yt_dlp_caption when it succeeds -- never calls later providers", async () => {
  let innertubeCalled = false;
  let sttCalled = false;
  const { transcript, attempts } = await dispatchTranscript(
    { videoId: VALID_ID, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
    {
      fetchMetadataFn: async () => BASE_META,
      ytDlpCaptionFn: async () => okResult("auto_caption"),
      innertubeFn: async () => {
        innertubeCalled = true;
        throw new Error("should not be called");
      },
      speechToTextFn: async () => {
        sttCalled = true;
        throw new Error("should not be called");
      },
    },
  );

  assert.equal(transcript.source, "auto_caption");
  assert.equal(attempts.length, 1);
  assert.equal(innertubeCalled, false);
  assert.equal(sttCalled, false);
});

test("throws IngestionError when the entire chain is exhausted", async () => {
  await assert.rejects(
    dispatchTranscript(
      { videoId: VALID_ID, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
      {
        fetchMetadataFn: async () => BASE_META,
        ytDlpCaptionFn: async () => {
          throw new ProviderFailure("yt_dlp_caption", ErrorCategory.CAPTIONS_FAILED, "x");
        },
        innertubeFn: async () => {
          throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "x");
        },
        speechToTextFn: async () => {
          throw new ProviderFailure("speech_to_text", ErrorCategory.NO_SPEECH_DETECTED, "no speech");
        },
      },
    ),
    (err) => {
      assert.ok(err instanceof IngestionError);
      assert.equal(err.category, ErrorCategory.NO_SPEECH_DETECTED);
      return true;
    },
  );
});

test("classifies a 429 from metadata fetch as rate_limited, not captions_failed", async () => {
  await assert.rejects(
    dispatchTranscript(
      { videoId: VALID_ID, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
      {
        fetchMetadataFn: async () => {
          throw new IngestionError(ErrorCategory.RATE_LIMITED, "429 Too Many Requests");
        },
      },
    ),
    (err) => {
      assert.equal(err.category, ErrorCategory.RATE_LIMITED);
      return true;
    },
  );
});

test("rejects video_too_long before attempting any provider", async () => {
  let anyProviderCalled = false;
  await assert.rejects(
    dispatchTranscript(
      { videoId: VALID_ID, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
      {
        fetchMetadataFn: async () => ({ title: "Long video", durationSeconds: 100 * 60 }),
        ytDlpCaptionFn: async () => {
          anyProviderCalled = true;
          return okResult("auto_caption");
        },
      },
    ),
    (err) => {
      assert.equal(err.category, ErrorCategory.VIDEO_TOO_LONG);
      return true;
    },
  );
  assert.equal(anyProviderCalled, false);
});

test("skips speech_to_text (and reports video_too_long) when captions fail on a video over the STT-specific cap", async () => {
  const { videoId } = { videoId: VALID_ID };
  let sttCalled = false;
  await assert.rejects(
    dispatchTranscript(
      { videoId, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
      {
        fetchMetadataFn: async () => ({ title: "40 min video", durationSeconds: 40 * 60 }),
        ytDlpCaptionFn: async () => {
          throw new ProviderFailure("yt_dlp_caption", ErrorCategory.CAPTIONS_FAILED, "x");
        },
        innertubeFn: async () => {
          throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "x");
        },
        speechToTextFn: async () => {
          sttCalled = true;
          return okResult("speech_to_text");
        },
      },
    ),
    (err) => {
      assert.equal(err.category, ErrorCategory.VIDEO_TOO_LONG);
      return true;
    },
  );
  assert.equal(sttCalled, false);
});

test("a provider that never resolves is treated as a timeout, not left hanging", async () => {
  const { transcript, attempts } = await dispatchTranscript(
    { videoId: VALID_ID, targetLanguage: "en", pythonBin: "python3", whisperModel: "tiny" },
    {
      fetchMetadataFn: async () => BASE_META,
      ytDlpCaptionFn: () => new Promise(() => {}), // never resolves
      innertubeFn: async () => {
        throw new ProviderFailure("innertube", ErrorCategory.CAPTIONS_FAILED, "x");
      },
      speechToTextFn: async () => okResult("speech_to_text"),
      timeoutsMs: { ytDlpCaption: 50, innertube: 50, speechToText: 50 },
    },
  );
  // The test itself would hang forever if withTimeout() didn't actually
  // race the hung promise -- reaching this assertion at all is the proof.
  assert.equal(transcript.source, "speech_to_text");
  assert.equal(attempts[0].category, ErrorCategory.TIMEOUT);
});
