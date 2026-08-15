import test from "node:test";
import assert from "node:assert/strict";
import { runYoutubeImport, getYoutubeImportStatus, YoutubeImportPersistenceError } from "./service.ts";
import type { WorkerIngestResponse } from "./worker-client.ts";
import { ErrorCategory } from "./types.ts";

// Minimal in-memory fake of the Supabase query-builder subset service.ts
// actually uses. Deliberately purpose-built, not a general mock -- enough
// to exercise real dedup/state-transition logic deterministically, with no
// real network or database involved (§18: mock external YouTube/DB in CI).
function makeFakeSupabase() {
  const texts: Record<string, unknown>[] = [];
  const captionSegments: Record<string, unknown>[] = [];
  let nextId = 1;
  let forceUniqueViolationOnce = false;
  let rpcErrorOnce: { code: string; message: string } | null = null;
  let textLookupErrorOnce: { code: string; message: string } | null = null;

  function textsTable() {
    const filters: [string, unknown][] = [];
    let pendingInsertResult: Record<string, unknown> | null = null;
    let pendingInsertError: { code: string; message: string } | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;

    function matches() {
      return texts.filter((t) =>
        filters
          .filter(([col]) => !col.startsWith("not_") && !col.startsWith("gte_"))
          .every(([col, val]) => (t as Record<string, unknown>)[col] === val),
      );
    }

    const builder = {
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return builder;
      },
      not(col: string, _op: string, _val: unknown) {
        filters.push([`not_${col}`, true]);
        return builder;
      },
      gte(col: string, val: unknown) {
        filters.push([`gte_${col}`, val]);
        return builder;
      },
      select(_cols: string, _opts?: { count?: string; head?: boolean }) {
        return builder;
      },
      insert(row: Record<string, unknown>) {
        if (forceUniqueViolationOnce) {
          forceUniqueViolationOnce = false;
          pendingInsertError = { code: "23505", message: "duplicate key value violates unique constraint" };
        } else {
          const created = { id: `text-${nextId++}`, created_at: new Date().toISOString(), ...row };
          texts.push(created);
          pendingInsertResult = created;
        }
        return builder;
      },
      update(patch: Record<string, unknown>) {
        pendingUpdate = patch;
        return builder;
      },
      async maybeSingle() {
        if (textLookupErrorOnce) {
          const error = textLookupErrorOnce;
          textLookupErrorOnce = null;
          return { data: null, error };
        }
        return { data: matches()[0] ?? null };
      },
      async single() {
        if (pendingInsertError) return { data: null, error: pendingInsertError };
        if (pendingInsertResult) return { data: pendingInsertResult, error: null };
        return { data: matches()[0] ?? null, error: null };
      },
      // Supabase query builders are thenable -- `await builder` (no
      // .single()/.maybeSingle()) is how update()/count-only select() calls
      // resolve in real code (service.ts's markFailed/reserveImportRow do
      // exactly this).
      then(resolve: (v: { data: null; error: null; count: number }) => void) {
        if (pendingUpdate) {
          for (const row of matches()) Object.assign(row, pendingUpdate);
        }
        resolve({ data: null, error: null, count: matches().length });
      },
    };
    return builder;
  }

  const fake = {
    _texts: texts,
    _captionSegments: captionSegments,
    _forceUniqueViolationOnce: () => {
      forceUniqueViolationOnce = true;
    },
    _failNextRpc(code = "XX000") {
      rpcErrorOnce = { code, message: "simulated persistence failure" };
    },
    _failNextTextLookup(code = "XX000") {
      textLookupErrorOnce = { code, message: "simulated text lookup failure" };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      assert.equal(name, "persist_youtube_import");
      if (rpcErrorOnce) {
        const error = rpcErrorOnce;
        rpcErrorOnce = null;
        return { data: null, error };
      }

      const textId = args.p_text_id as string;
      const rows = args.p_segments as Record<string, unknown>[];
      const text = texts.find((row) => row.id === textId);
      if (!text) return { data: null, error: { code: "42501", message: "not owned" } };

      for (let index = captionSegments.length - 1; index >= 0; index -= 1) {
        if (captionSegments[index].text_id === textId) captionSegments.splice(index, 1);
      }
      captionSegments.push(...rows.map((row) => ({ ...row, text_id: textId })));
      Object.assign(text, {
        title: args.p_title,
        youtube_duration_seconds: args.p_duration_seconds,
        transcript_source: args.p_transcript_source,
        language: args.p_language,
        word_count: args.p_word_count,
        processing_status: "ready",
        processing_stage: null,
        processing_error: null,
      });
      return { data: rows.length, error: null };
    },
    from(table: string) {
      if (table === "texts") return textsTable();
      if (table === "caption_segments") {
        return {
          async insert(rows: Record<string, unknown>[]) {
            captionSegments.push(...rows);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return fake as unknown as import("@/lib/supabase/server").SupabaseServerClient & typeof fake;
}

function makeSegments(count: number, totalDurationMs = 6_993_000) {
  const stepMs = Math.floor(totalDurationMs / count);
  return Array.from({ length: count }, (_, index) => ({
    startMs: index * stepMs,
    endMs: index === count - 1 ? totalDurationMs : (index + 1) * stepMs,
    text: `segment ${index} with enough transcript text`,
  }));
}

function okTranscriptResponse(overrides: Partial<WorkerIngestResponse & { ok: true }> = {}): WorkerIngestResponse {
  return {
    ok: true,
    attempts: [{ provider: "yt_dlp_caption", outcome: "success" }],
    ingestionDurationMs: 500,
    transcript: {
      videoId: "abcDEF_123-",
      title: "Test video",
      languageCode: "en",
      durationMs: 19000,
      source: "auto_caption",
      segments: [{ startMs: 0, endMs: 1000, text: "hello world" }],
    },
    ...overrides,
  } as WorkerIngestResponse;
}

test("invalid URL never touches the database or the worker", async () => {
  const supabase = makeFakeSupabase();
  let workerCalled = false;
  const outcome = await runYoutubeImport(supabase, "user-1", "not a url", "en", async () => {
    workerCalled = true;
    return okTranscriptResponse();
  });
  assert.equal(outcome.error, ErrorCategory.INVALID_URL);
  assert.equal(workerCalled, false);
  assert.equal(supabase._texts.length, 0);
});

test("a successful import creates exactly one texts row and persists segments, then flips to ready", async () => {
  const supabase = makeFakeSupabase();
  const outcome = await runYoutubeImport(
    supabase,
    "user-1",
    "https://www.youtube.com/watch?v=abcDEF_123-",
    "en",
    async () => okTranscriptResponse(),
  );
  assert.equal(outcome.status, "ready");
  assert.equal(outcome.readyRoute, `/watch/${outcome.textId}`);
  assert.equal(supabase._texts.length, 1);
  assert.equal(supabase._texts[0].processing_status, "ready");
  assert.equal(supabase._texts[0].transcript_source, "auto_caption");
  assert.equal(supabase._captionSegments.length, 1);
});

test("a complete 116-minute browser-bridge transcript persists without raising the worker cost cap", async () => {
  const supabase = makeFakeSupabase();
  const response = okTranscriptResponse({
    transcript: {
      videoId: "PolmvqSxnbc",
      title: "Robinson Crusoe",
      languageCode: "en",
      durationMs: 6_993_000,
      source: "browser_bridge",
      segments: makeSegments(973),
    },
  });
  const outcome = await runYoutubeImport(
    supabase,
    "user-1",
    "https://youtu.be/PolmvqSxnbc?si=share-token",
    "en",
    async () => response,
  );

  assert.equal(outcome.status, "ready");
  assert.equal(supabase._texts[0].youtube_duration_seconds, 6_993);
  assert.equal(supabase._captionSegments.length, 973);
  assert.equal(supabase._captionSegments[972].segment_index, 972);
});

test("the original 60-minute cap remains enforced for worker-acquired transcripts", async () => {
  const supabase = makeFakeSupabase();
  const response = okTranscriptResponse({
    transcript: {
      videoId: "abcDEF_123-",
      title: "Long worker video",
      languageCode: "en",
      durationMs: 6_993_000,
      source: "auto_caption",
      segments: [{ startMs: 0, endMs: 6_993_000, text: "worker transcript" }],
    },
  });
  const outcome = await runYoutubeImport(
    supabase,
    "user-1",
    "https://www.youtube.com/watch?v=abcDEF_123-",
    "en",
    async () => response,
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.error, ErrorCategory.VIDEO_TOO_LONG);
  assert.equal(supabase._captionSegments.length, 0);
});

test("duplicate import (same user, same video) reuses the existing ready row -- no second row, no second worker call", async () => {
  const supabase = makeFakeSupabase();
  await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=abcDEF_123-", "en", async () => okTranscriptResponse());
  assert.equal(supabase._texts.length, 1);

  let secondWorkerCallCount = 0;
  const second = await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=abcDEF_123-", "en", async () => {
    secondWorkerCallCount += 1;
    return okTranscriptResponse();
  });

  assert.equal(supabase._texts.length, 1, "must not create a second row for the same user+video");
  assert.equal(secondWorkerCallCount, 0, "must not re-run the pipeline for an already-ready import");
  assert.equal(second.status, "ready");
  assert.equal(second.textId, supabase._texts[0].id);
});

test("a currently-processing import returns its current status instead of starting a second run", async () => {
  const supabase = makeFakeSupabase();
  supabase._texts.push({
    id: "text-existing",
    owner_id: "user-1",
    youtube_video_id: "abcDEF_123-",
    processing_status: "processing",
    processing_stage: "transcribing",
  });

  let workerCalled = false;
  const outcome = await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=abcDEF_123-", "en", async () => {
    workerCalled = true;
    return okTranscriptResponse();
  });

  assert.equal(workerCalled, false);
  assert.equal(outcome.status, "processing");
  assert.equal(outcome.stage, "transcribing");
});

test("a failed import can be retried -- reuses the same row, resets it, runs the pipeline again", async () => {
  const supabase = makeFakeSupabase();
  supabase._texts.push({
    id: "text-existing",
    owner_id: "user-1",
    youtube_video_id: "abcDEF_123-",
    processing_status: "failed",
    processing_stage: null,
    processing_error: "captions_failed",
  });

  const outcome = await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=abcDEF_123-", "en", async () =>
    okTranscriptResponse(),
  );

  assert.equal(supabase._texts.length, 1, "retry must not create a second row");
  assert.equal(outcome.status, "ready");
  assert.equal(outcome.textId, "text-existing");
});

test("a retry atomically reconciles partial captions instead of duplicating or truncating them", async () => {
  const supabase = makeFakeSupabase();
  supabase._texts.push({
    id: "text-partial",
    owner_id: "user-1",
    youtube_video_id: "PolmvqSxnbc",
    processing_status: "failed",
    processing_stage: null,
    processing_error: "storage_failed",
  });
  supabase._captionSegments.push(
    ...Array.from({ length: 12 }, (_, index) => ({
      text_id: "text-partial",
      start_ms: index * 1000,
      end_ms: (index + 1) * 1000,
      body: `partial ${index}`,
      segment_index: index,
    })),
  );
  const diagnostics: { event: string; metadata: Record<string, unknown> }[] = [];

  const outcome = await runYoutubeImport(
    supabase,
    "user-1",
    "https://youtu.be/PolmvqSxnbc?si=retry",
    "en",
    async () => okTranscriptResponse({
      transcript: {
        videoId: "PolmvqSxnbc",
        title: "Robinson Crusoe",
        languageCode: "en",
        durationMs: 6_993_000,
        source: "browser_bridge",
        segments: makeSegments(973),
      },
    }),
    {},
    (event, metadata = {}) => diagnostics.push({ event, metadata }),
  );

  assert.equal(outcome.status, "ready");
  assert.equal(outcome.textId, "text-partial");
  assert.equal(supabase._texts.length, 1);
  assert.equal(supabase._captionSegments.length, 973);
  assert.deepEqual(
    diagnostics.filter(({ event }) => event === "transaction_commit_success").map(({ metadata }) => metadata.captionCount),
    [973],
  );
});

test("a persistence RPC failure returns a structured diagnostic and never reports ready", async () => {
  const supabase = makeFakeSupabase();
  supabase._failNextRpc("57014");
  const diagnostics: { event: string; metadata: Record<string, unknown> }[] = [];

  const outcome = await runYoutubeImport(
    supabase,
    "user-1",
    "https://www.youtube.com/watch?v=abcDEF_123-",
    "en",
    async () => okTranscriptResponse(),
    {},
    (event, metadata = {}) => diagnostics.push({ event, metadata }),
  );

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.error, ErrorCategory.STORAGE_FAILED);
  assert.equal(outcome.diagnosticCode, "persistence_timeout");
  assert.equal(supabase._texts[0].processing_status, "failed");
  assert.equal(supabase._captionSegments.length, 0);
  assert.equal(diagnostics.some(({ event }) => event === "transaction_commit_failed"), true);
});

test("schema drift at the initial text lookup is surfaced as schema_mismatch", async () => {
  const supabase = makeFakeSupabase();
  supabase._failNextTextLookup("42703");

  await assert.rejects(
    runYoutubeImport(
      supabase,
      "user-1",
      "https://www.youtube.com/watch?v=abcDEF_123-",
      "en",
      async () => okTranscriptResponse(),
    ),
    (error: unknown) => {
      assert.equal(error instanceof YoutubeImportPersistenceError, true);
      assert.equal((error as YoutubeImportPersistenceError).diagnosticCode, "schema_mismatch");
      assert.equal((error as YoutubeImportPersistenceError).databaseCode, "42703");
      return true;
    },
  );
});

test("a concurrent duplicate insert (unique-violation race) is handled safely -- no crash, no duplicate row", async () => {
  const supabase = makeFakeSupabase();
  // Simulate: another request already created the row between our dedup
  // check and our insert.
  supabase._texts.push({
    id: "text-winner",
    owner_id: "user-1",
    youtube_video_id: "zzzZZZ_999-",
    processing_status: "pending",
    processing_stage: null,
  });
  supabase._forceUniqueViolationOnce();

  const outcome = await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=zzzZZZ_999-", "en", async () =>
    okTranscriptResponse(),
  );

  assert.equal(outcome.textId, "text-winner");
  assert.equal(supabase._texts.length, 1);
});

test("a worker failure leaves the row failed with no caption_segments -- no fake ready content", async () => {
  const supabase = makeFakeSupabase();
  const outcome = await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=abcDEF_123-", "en", async () => ({
    ok: false,
    error: ErrorCategory.CAPTIONS_FAILED,
    message: "no captions",
    attempts: [],
    ingestionDurationMs: 100,
  }));

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.error, ErrorCategory.CAPTIONS_FAILED);
  assert.equal(supabase._texts[0].processing_status, "failed");
  assert.equal(supabase._captionSegments.length, 0);
});

test("a malformed worker response (empty segments) fails the import rather than saving garbage", async () => {
  const supabase = makeFakeSupabase();
  const outcome = await runYoutubeImport(supabase, "user-1", "https://www.youtube.com/watch?v=abcDEF_123-", "en", async () =>
    okTranscriptResponse({ transcript: { videoId: "abcDEF_123-", title: "x", languageCode: "en", source: "auto_caption", segments: [] } }),
  );

  assert.equal(outcome.status, "failed");
  assert.equal(supabase._captionSegments.length, 0);
  assert.notEqual(supabase._texts[0].processing_status, "ready");
});

test("getYoutubeImportStatus returns null for a different owner (never leaks another user's import)", async () => {
  const supabase = makeFakeSupabase();
  supabase._texts.push({
    id: "text-1",
    owner_id: "user-1",
    youtube_video_id: "abcDEF_123-",
    processing_status: "ready",
    processing_stage: null,
    processing_error: null,
  });

  const status = await getYoutubeImportStatus(supabase, "user-2", "text-1");
  assert.equal(status, null);
});

test("getYoutubeImportStatus returns the real status for the owning user", async () => {
  const supabase = makeFakeSupabase();
  supabase._texts.push({
    id: "text-1",
    owner_id: "user-1",
    youtube_video_id: "abcDEF_123-",
    processing_status: "ready",
    processing_stage: null,
    processing_error: null,
  });

  const status = await getYoutubeImportStatus(supabase, "user-1", "text-1");
  assert.equal(status?.status, "ready");
  assert.equal(status?.readyRoute, "/watch/text-1");
});
