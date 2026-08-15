// The single central YouTube import service — no import logic is duplicated
// across UI/API/server actions (Slice 12 brief §2). Everything the future
// Video Reader and the import form need goes through here.
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { extractVideoId } from "./video-id.ts";
import { callIngestionWorker, WorkerUnavailableError, type WorkerIngestResponse } from "./worker-client.ts";
import { assertValidTranscriptResult, MalformedTranscriptError } from "./validate-transcript.ts";
import {
  MAX_BROWSER_BRIDGE_VIDEO_DURATION_SECONDS,
  MAX_VIDEO_DURATION_SECONDS,
  MAX_IMPORTS_PER_USER_PER_HOUR,
} from "./limits.ts";
import {
  ErrorCategory,
  ImportDiagnosticCode,
  type ImportDiagnosticCodeValue,
  type ImportDiagnosticSink,
  type ImportOutcome,
  type ErrorCategoryValue,
} from "./types.ts";
import { serializedJsonBytes } from "./diagnostics.ts";

const DEFAULT_TARGET_LANGUAGE = "en";

type DatabaseError = { code?: unknown } | null | undefined;

function databaseErrorCode(error: DatabaseError): string | null {
  return typeof error?.code === "string" ? error.code : null;
}

function classifyPersistenceError(
  fallback: ImportDiagnosticCodeValue,
  error: DatabaseError,
): ImportDiagnosticCodeValue {
  const code = databaseErrorCode(error);
  if (code === "42703" || code === "PGRST204" || code === "PGRST202") {
    return ImportDiagnosticCode.SCHEMA_MISMATCH;
  }
  if (code === "57014" || code === "PGRST003") {
    return ImportDiagnosticCode.PERSISTENCE_TIMEOUT;
  }
  if (code === "413" || code === "PGRST102") {
    return ImportDiagnosticCode.PAYLOAD_TOO_LARGE;
  }
  return fallback;
}

export class YoutubeImportPersistenceError extends Error {
  readonly diagnosticCode: ImportDiagnosticCodeValue;
  readonly databaseCode: string | null;

  constructor(diagnosticCode: ImportDiagnosticCodeValue, error?: DatabaseError) {
    super(diagnosticCode);
    this.name = "YoutubeImportPersistenceError";
    this.diagnosticCode = classifyPersistenceError(diagnosticCode, error);
    this.databaseCode = databaseErrorCode(error);
  }
}

function emitDiagnostic(
  diagnostic: ImportDiagnosticSink | undefined,
  event: string,
  metadata: Record<string, unknown> = {},
) {
  diagnostic?.(event, metadata);
}

async function markFailed(
  supabase: SupabaseServerClient,
  textId: string,
  category: ErrorCategoryValue,
  diagnostic?: ImportDiagnosticSink,
): Promise<void> {
  const { error } = await supabase
    .from("texts")
    .update({ processing_status: "failed", processing_stage: null, processing_error: category })
    .eq("id", textId);
  if (error) {
    emitDiagnostic(diagnostic, "text_insert_failed", {
      operation: "mark_failed",
      diagnosticCode: classifyPersistenceError(ImportDiagnosticCode.TEXT_UPDATE_FAILED, error),
      databaseCode: databaseErrorCode(error),
    });
  }
}

/**
 * Dedup + create/reuse the `texts` row for a YouTube import (§9/§10/§11).
 * Never inserts a second row for the same (owner, video). Returns the row
 * id and whether the caller still needs to run the pipeline (a `ready` or
 * already-`processing` row means: don't).
 */
async function reserveImportRow(
  supabase: SupabaseServerClient,
  ownerId: string,
  videoId: string,
  targetLanguage: string,
  collection: { collectionId?: string | null; collectionOrder?: number | null },
  diagnostic?: ImportDiagnosticSink,
): Promise<{ textId: string; needsWork: boolean; outcome?: ImportOutcome }> {
  const { data: existing, error: lookupError } = await supabase
    .from("texts")
    .select("id, processing_status, processing_stage, processing_error")
    .eq("owner_id", ownerId)
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (lookupError) {
    const diagnosticCode = classifyPersistenceError(ImportDiagnosticCode.TEXT_LOOKUP_FAILED, lookupError);
    emitDiagnostic(diagnostic, "text_insert_failed", {
      operation: "lookup",
      diagnosticCode,
      databaseCode: databaseErrorCode(lookupError),
    });
    throw new YoutubeImportPersistenceError(diagnosticCode, lookupError);
  }

  if (existing) {
    if (existing.processing_status === "ready") {
      emitDiagnostic(diagnostic, "text_insert_success", {
        textId: existing.id,
        reused: true,
        existingStatus: "ready",
        diagnosticCode: ImportDiagnosticCode.DUPLICATE_VIDEO,
      });
      return {
        textId: existing.id,
        needsWork: false,
        outcome: { textId: existing.id, status: "ready", stage: null, error: null, readyRoute: `/watch/${existing.id}` },
      };
    }
    if (existing.processing_status === "pending" || existing.processing_status === "processing") {
      emitDiagnostic(diagnostic, "text_insert_success", {
        textId: existing.id,
        reused: true,
        existingStatus: existing.processing_status,
        diagnosticCode: ImportDiagnosticCode.DUPLICATE_VIDEO,
      });
      return {
        textId: existing.id,
        needsWork: false,
        outcome: {
          textId: existing.id,
          status: existing.processing_status,
          stage: existing.processing_stage,
          error: null,
        },
      };
    }
    // failed -- explicit retry: reuse the row, reset it, and proceed.
    const { error: resetError } = await supabase
      .from("texts")
      .update({ processing_status: "pending", processing_stage: null, processing_error: null })
      .eq("id", existing.id);
    if (resetError) {
      const diagnosticCode = classifyPersistenceError(ImportDiagnosticCode.TEXT_UPDATE_FAILED, resetError);
      emitDiagnostic(diagnostic, "text_insert_failed", {
        operation: "reset_failed_import",
        textId: existing.id,
        diagnosticCode,
        databaseCode: databaseErrorCode(resetError),
      });
      throw new YoutubeImportPersistenceError(diagnosticCode, resetError);
    }
    emitDiagnostic(diagnostic, "text_insert_success", {
      textId: existing.id,
      reused: true,
      existingStatus: "failed",
    });
    return { textId: existing.id, needsWork: true };
  }

  emitDiagnostic(diagnostic, "text_insert_started", { videoId });
  const { data: inserted, error: insertError } = await supabase
    .from("texts")
    .insert({
      owner_id: ownerId,
      title: `YouTube ${videoId}`, // placeholder, overwritten once the worker returns the real title
      body: "",
      source_type: "youtube",
      source_url: `https://www.youtube.com/watch?v=${videoId}`,
      language: targetLanguage,
      youtube_video_id: videoId,
      processing_status: "pending",
      collection_id: collection.collectionId ?? null,
      collection_order: collection.collectionOrder ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique-violation race (§11): another concurrent request for the same
    // (owner, video) won the insert first -- re-query and treat as found,
    // never create a duplicate row.
    if (insertError.code === "23505") {
      const { data: winner, error: winnerError } = await supabase
        .from("texts")
        .select("id, processing_status, processing_stage")
        .eq("owner_id", ownerId)
        .eq("youtube_video_id", videoId)
        .single();
      if (winnerError) {
        const diagnosticCode = classifyPersistenceError(ImportDiagnosticCode.TEXT_LOOKUP_FAILED, winnerError);
        emitDiagnostic(diagnostic, "text_insert_failed", {
          operation: "duplicate_winner_lookup",
          diagnosticCode,
          databaseCode: databaseErrorCode(winnerError),
        });
        throw new YoutubeImportPersistenceError(diagnosticCode, winnerError);
      }
      if (winner) {
        emitDiagnostic(diagnostic, "text_insert_success", {
          textId: winner.id,
          reused: true,
          existingStatus: winner.processing_status,
          diagnosticCode: ImportDiagnosticCode.DUPLICATE_VIDEO,
        });
        return {
          textId: winner.id,
          needsWork: false,
          outcome: { textId: winner.id, status: winner.processing_status, stage: winner.processing_stage, error: null },
        };
      }
    }
    const diagnosticCode = classifyPersistenceError(ImportDiagnosticCode.TEXT_INSERT_FAILED, insertError);
    emitDiagnostic(diagnostic, "text_insert_failed", {
      operation: "insert",
      diagnosticCode,
      databaseCode: databaseErrorCode(insertError),
    });
    throw new YoutubeImportPersistenceError(diagnosticCode, insertError);
  }

  emitDiagnostic(diagnostic, "text_insert_success", {
    textId: inserted.id,
    reused: false,
  });
  return { textId: inserted.id, needsWork: true };
}

/**
 * Runs the full pipeline for a row already reserved by reserveImportRow():
 * dispatch to the worker, validate its response, persist segments, flip the
 * row to ready/failed. This is currently synchronous end-to-end (§13's
 * known limitation -- see the Slice 12 backend-implementation report for
 * why: no queue/webhook exists yet for long STT-fallback jobs to report
 * progress incrementally).
 */
async function runImportPipeline(
  supabase: SupabaseServerClient,
  textId: string,
  videoId: string,
  targetLanguage: string,
  callWorker: typeof callIngestionWorker,
  diagnostic?: ImportDiagnosticSink,
): Promise<ImportOutcome> {
  const { error: processingError } = await supabase
    .from("texts")
    .update({ processing_status: "processing", processing_stage: "validating" })
    .eq("id", textId);
  if (processingError) {
    throw new YoutubeImportPersistenceError(ImportDiagnosticCode.TEXT_UPDATE_FAILED, processingError);
  }

  let response: WorkerIngestResponse;
  try {
    response = await callWorker({ videoId, targetLanguage });
  } catch (err) {
    const category = err instanceof WorkerUnavailableError ? ErrorCategory.WORKER_UNAVAILABLE : ErrorCategory.TRANSCRIPTION_FAILED;
    await markFailed(supabase, textId, category, diagnostic);
    return { textId, status: "failed", stage: null, error: category };
  }

  if (!response.ok) {
    await markFailed(supabase, textId, response.error, diagnostic);
    return { textId, status: "failed", stage: null, error: response.error };
  }

  try {
    assertValidTranscriptResult(response.transcript);
  } catch (err) {
    const category = err instanceof MalformedTranscriptError ? ErrorCategory.STORAGE_FAILED : ErrorCategory.TRANSCRIPTION_FAILED;
    await markFailed(supabase, textId, category, diagnostic);
    return {
      textId,
      status: "failed",
      stage: null,
      error: category,
      diagnosticCode: ImportDiagnosticCode.VALIDATION_FAILED,
    };
  }

  const { transcript } = response;
  const maximumDurationSeconds = transcript.source === "browser_bridge"
    ? MAX_BROWSER_BRIDGE_VIDEO_DURATION_SECONDS
    : MAX_VIDEO_DURATION_SECONDS;
  const actualDurationSeconds = transcript.durationMs ? transcript.durationMs / 1000 : null;
  const acceptedByDuration = actualDurationSeconds === null || actualDurationSeconds <= maximumDurationSeconds;
  emitDiagnostic(diagnostic, "ingestion_limits_checked", {
    videoId,
    transcriptSource: transcript.source,
    sourceRule: transcript.source === "browser_bridge" ? "browser_bridge_2h" : "worker_stt_60m",
    effectiveLimitSeconds: maximumDurationSeconds,
    actualDurationSeconds,
    accepted: acceptedByDuration,
  });
  if (!acceptedByDuration) {
    await markFailed(supabase, textId, ErrorCategory.VIDEO_TOO_LONG, diagnostic);
    return {
      textId,
      status: "failed",
      stage: null,
      error: ErrorCategory.VIDEO_TOO_LONG,
      diagnosticCode: ImportDiagnosticCode.DURATION_LIMIT,
    };
  }

  const { error: savingStageError } = await supabase
    .from("texts")
    .update({ processing_stage: "saving" })
    .eq("id", textId);
  if (savingStageError) {
    throw new YoutubeImportPersistenceError(ImportDiagnosticCode.TEXT_UPDATE_FAILED, savingStageError);
  }

  const body = transcript.segments.map((s) => s.text).join(" ");

  const captionRows = transcript.segments.map((seg, index) => ({
    start_ms: seg.startMs,
    end_ms: seg.endMs,
    body: seg.text,
    segment_index: index,
  }));
  const captionPayloadBytes = serializedJsonBytes(captionRows);
  emitDiagnostic(diagnostic, "caption_segments_insert_started", {
    textId,
    count: captionRows.length,
    serializedPayloadBytes: captionPayloadBytes,
  });

  // One owner-scoped Postgres RPC replaces any partial prior rows, inserts
  // every canonical segment, and flips the text to ready in one transaction.
  // A failure rolls the whole operation back, so retries are idempotent and
  // cannot leave a ready text with truncated captions.
  const { data: insertedCount, error: persistenceError } = await supabase.rpc(
    "persist_youtube_import",
    {
      p_text_id: textId,
      p_title: transcript.title,
      p_duration_seconds: transcript.durationMs ? Math.round(transcript.durationMs / 1000) : null,
      p_transcript_source: transcript.source,
      p_language: transcript.languageCode,
      p_word_count: body.split(/\s+/).filter(Boolean).length,
      p_segments: captionRows,
    },
  );

  if (persistenceError) {
    const diagnosticCode = classifyPersistenceError(ImportDiagnosticCode.TRANSACTION_FAILED, persistenceError);
    emitDiagnostic(diagnostic, "caption_segments_insert_failed", {
      textId,
      count: captionRows.length,
      diagnosticCode: diagnosticCode === ImportDiagnosticCode.TRANSACTION_FAILED
        ? ImportDiagnosticCode.CAPTION_INSERT_FAILED
        : diagnosticCode,
      databaseCode: databaseErrorCode(persistenceError),
    });
    emitDiagnostic(diagnostic, "transaction_commit_failed", {
      textId,
      diagnosticCode,
      databaseCode: databaseErrorCode(persistenceError),
    });
    await markFailed(supabase, textId, ErrorCategory.STORAGE_FAILED, diagnostic);
    return {
      textId,
      status: "failed",
      stage: null,
      error: ErrorCategory.STORAGE_FAILED,
      diagnosticCode,
    };
  }

  if (insertedCount !== captionRows.length) {
    emitDiagnostic(diagnostic, "caption_segments_insert_failed", {
      textId,
      expectedCount: captionRows.length,
      actualCount: insertedCount,
      diagnosticCode: ImportDiagnosticCode.PAYLOAD_COUNT_MISMATCH,
    });
    emitDiagnostic(diagnostic, "transaction_commit_failed", {
      textId,
      diagnosticCode: ImportDiagnosticCode.PAYLOAD_COUNT_MISMATCH,
    });
    await markFailed(supabase, textId, ErrorCategory.STORAGE_FAILED, diagnostic);
    return {
      textId,
      status: "failed",
      stage: null,
      error: ErrorCategory.STORAGE_FAILED,
      diagnosticCode: ImportDiagnosticCode.PAYLOAD_COUNT_MISMATCH,
    };
  }

  emitDiagnostic(diagnostic, "caption_segments_insert_success", {
    textId,
    count: insertedCount,
  });
  emitDiagnostic(diagnostic, "transaction_commit_success", {
    textId,
    captionCount: insertedCount,
  });

  return { textId, status: "ready", stage: null, error: null, readyRoute: `/watch/${textId}` };
}

/**
 * The one entry point every caller (server action, future Video Reader,
 * tests) uses to start or resume a YouTube import. §2/§13.
 */
export async function runYoutubeImport(
  supabase: SupabaseServerClient,
  ownerId: string,
  rawUrl: string,
  targetLanguage: string = DEFAULT_TARGET_LANGUAGE,
  /** Injectable worker call — production call sites never pass this; tests
   * use it to mock external YouTube deterministically (§18). */
  callWorker: typeof callIngestionWorker = callIngestionWorker,
  /** Optional collection assignment (§ existing Library "collections"
   * feature, unrelated to Slice 12 -- preserved so switching the form's
   * fallback path to this service doesn't regress it). */
  collection: { collectionId?: string | null; collectionOrder?: number | null } = {},
  /** Optional request-scoped metadata-only diagnostics. */
  diagnostic?: ImportDiagnosticSink,
): Promise<ImportOutcome> {
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    return { textId: "", status: "failed", stage: null, error: ErrorCategory.INVALID_URL };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error: rateLimitError } = await supabase
    .from("texts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .not("youtube_video_id", "is", null)
    .gte("created_at", oneHourAgo);
  if (rateLimitError) {
    throw new YoutubeImportPersistenceError(ImportDiagnosticCode.TEXT_LOOKUP_FAILED, rateLimitError);
  }
  if ((count ?? 0) >= MAX_IMPORTS_PER_USER_PER_HOUR) {
    return {
      textId: "",
      status: "failed",
      stage: null,
      error: ErrorCategory.RATE_LIMITED,
      diagnosticCode: ImportDiagnosticCode.RATE_LIMITED,
    };
  }

  const reserved = await reserveImportRow(supabase, ownerId, videoId, targetLanguage, collection, diagnostic);
  if (!reserved.needsWork) {
    return reserved.outcome!;
  }

  return runImportPipeline(supabase, reserved.textId, videoId, targetLanguage, callWorker, diagnostic);
}

/** Safe, authenticated status read for an existing import (§14). Returns
 * null if the row doesn't exist or doesn't belong to this owner -- callers
 * must treat that as "not found," never leak existence across owners. */
export async function getYoutubeImportStatus(
  supabase: SupabaseServerClient,
  ownerId: string,
  textId: string,
): Promise<ImportOutcome | null> {
  const { data } = await supabase
    .from("texts")
    .select("id, processing_status, processing_stage, processing_error, youtube_video_id")
    .eq("id", textId)
    .eq("owner_id", ownerId)
    .not("youtube_video_id", "is", null)
    .maybeSingle();

  if (!data) return null;
  return {
    textId: data.id,
    status: data.processing_status,
    stage: data.processing_stage,
    error: data.processing_error as ErrorCategoryValue | null,
    readyRoute: data.processing_status === "ready" ? `/watch/${data.id}` : undefined,
  };
}
