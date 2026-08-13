// The single central YouTube import service — no import logic is duplicated
// across UI/API/server actions (Slice 12 brief §2). Everything the future
// Video Reader and the import form need goes through here.
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { extractVideoId } from "./video-id.ts";
import { callIngestionWorker, WorkerUnavailableError, type WorkerIngestResponse } from "./worker-client.ts";
import { assertValidTranscriptResult, MalformedTranscriptError } from "./validate-transcript.ts";
import { MAX_VIDEO_DURATION_SECONDS, MAX_IMPORTS_PER_USER_PER_HOUR } from "./limits.ts";
import { ErrorCategory, type ImportOutcome, type ErrorCategoryValue } from "./types.ts";

const DEFAULT_TARGET_LANGUAGE = "en";

async function markFailed(
  supabase: SupabaseServerClient,
  textId: string,
  category: ErrorCategoryValue,
): Promise<void> {
  await supabase
    .from("texts")
    .update({ processing_status: "failed", processing_stage: null, processing_error: category })
    .eq("id", textId);
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
): Promise<{ textId: string; needsWork: boolean; outcome?: ImportOutcome }> {
  const { data: existing } = await supabase
    .from("texts")
    .select("id, processing_status, processing_stage, processing_error")
    .eq("owner_id", ownerId)
    .eq("youtube_video_id", videoId)
    .maybeSingle();

  if (existing) {
    if (existing.processing_status === "ready") {
      return {
        textId: existing.id,
        needsWork: false,
        outcome: { textId: existing.id, status: "ready", stage: null, error: null, readyRoute: `/watch/${existing.id}` },
      };
    }
    if (existing.processing_status === "pending" || existing.processing_status === "processing") {
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
    await supabase
      .from("texts")
      .update({ processing_status: "pending", processing_stage: null, processing_error: null })
      .eq("id", existing.id);
    return { textId: existing.id, needsWork: true };
  }

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
      const { data: winner } = await supabase
        .from("texts")
        .select("id, processing_status, processing_stage")
        .eq("owner_id", ownerId)
        .eq("youtube_video_id", videoId)
        .single();
      if (winner) {
        return {
          textId: winner.id,
          needsWork: false,
          outcome: { textId: winner.id, status: winner.processing_status, stage: winner.processing_stage, error: null },
        };
      }
    }
    throw new Error(`Failed to create import row: ${insertError.message}`);
  }

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
): Promise<ImportOutcome> {
  await supabase
    .from("texts")
    .update({ processing_status: "processing", processing_stage: "validating" })
    .eq("id", textId);

  let response: WorkerIngestResponse;
  try {
    response = await callWorker({ videoId, targetLanguage });
  } catch (err) {
    const category = err instanceof WorkerUnavailableError ? ErrorCategory.WORKER_UNAVAILABLE : ErrorCategory.TRANSCRIPTION_FAILED;
    await markFailed(supabase, textId, category);
    return { textId, status: "failed", stage: null, error: category };
  }

  if (!response.ok) {
    await markFailed(supabase, textId, response.error);
    return { textId, status: "failed", stage: null, error: response.error };
  }

  try {
    assertValidTranscriptResult(response.transcript);
  } catch (err) {
    const category = err instanceof MalformedTranscriptError ? ErrorCategory.STORAGE_FAILED : ErrorCategory.TRANSCRIPTION_FAILED;
    await markFailed(supabase, textId, category);
    return { textId, status: "failed", stage: null, error: category };
  }

  const { transcript } = response;
  if (transcript.durationMs && transcript.durationMs / 1000 > MAX_VIDEO_DURATION_SECONDS) {
    await markFailed(supabase, textId, ErrorCategory.VIDEO_TOO_LONG);
    return { textId, status: "failed", stage: null, error: ErrorCategory.VIDEO_TOO_LONG };
  }

  await supabase.from("texts").update({ processing_stage: "saving" }).eq("id", textId);

  const body = transcript.segments.map((s) => s.text).join(" ");

  // Segments first (a single bulk INSERT is atomic at the Postgres level --
  // either every row lands or none do), THEN flip the row to ready. If this
  // insert fails, the row simply stays non-ready with no segments attached
  // -- never "ready" with a partial transcript.
  const { error: segmentsError } = await supabase.from("caption_segments").insert(
    transcript.segments.map((seg, index) => ({
      text_id: textId,
      start_ms: seg.startMs,
      end_ms: seg.endMs,
      body: seg.text,
      segment_index: index,
    })),
  );

  if (segmentsError) {
    await markFailed(supabase, textId, ErrorCategory.STORAGE_FAILED);
    return { textId, status: "failed", stage: null, error: ErrorCategory.STORAGE_FAILED };
  }

  const { error: finalizeError } = await supabase
    .from("texts")
    .update({
      title: transcript.title,
      youtube_duration_seconds: transcript.durationMs ? Math.round(transcript.durationMs / 1000) : null,
      transcript_source: transcript.source,
      language: transcript.languageCode,
      word_count: body.split(/\s+/).filter(Boolean).length,
      processing_status: "ready",
      processing_stage: null,
      processing_error: null,
    })
    .eq("id", textId);

  if (finalizeError) {
    // Segments exist but the row never flipped to ready -- stays
    // "processing" (safe, recoverable), not silently "ready".
    await markFailed(supabase, textId, ErrorCategory.STORAGE_FAILED);
    return { textId, status: "failed", stage: null, error: ErrorCategory.STORAGE_FAILED };
  }

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
): Promise<ImportOutcome> {
  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    return { textId: "", status: "failed", stage: null, error: ErrorCategory.INVALID_URL };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("texts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .not("youtube_video_id", "is", null)
    .gte("created_at", oneHourAgo);
  if ((count ?? 0) >= MAX_IMPORTS_PER_USER_PER_HOUR) {
    return { textId: "", status: "failed", stage: null, error: ErrorCategory.RATE_LIMITED };
  }

  const reserved = await reserveImportRow(supabase, ownerId, videoId, targetLanguage, collection);
  if (!reserved.needsWork) {
    return reserved.outcome!;
  }

  return runImportPipeline(supabase, reserved.textId, videoId, targetLanguage, callWorker);
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
