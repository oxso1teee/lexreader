"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasFreeTextRoom, resolveCollectionAssignment } from "./actions";
import {
  runYoutubeImport,
  YoutubeImportPersistenceError,
} from "@/lib/youtube-ingestion/service";
import { assertValidTranscriptResult, MalformedTranscriptError } from "@/lib/youtube-ingestion/validate-transcript";
import {
  ErrorCategory,
  ImportDiagnosticCode,
  type ImportDiagnosticCodeValue,
  type ImportOutcome,
  type TranscriptResult,
} from "@/lib/youtube-ingestion/types";
import { transcriptDiagnosticMetadata } from "@/lib/youtube-ingestion/diagnostics";
import { log } from "@/lib/log";

// The one entry point the import form calls for the new worker-backed
// pipeline (§13/§15 of the Slice 12 backend brief) -- no import logic lives
// here beyond the paywall gate and auth, everything else is
// runYoutubeImport()'s job, so nothing is duplicated across this action,
// any future API route, or tests.

// Deliberately shaped like the existing YoutubeImportState (error/paywall/
// redirectTo only) so the import form doesn't need a second state shape or
// polling UI yet -- the pipeline runs synchronously within this action, so
// by the time it returns the import is normally already ready or failed.
export interface StartYoutubeImportState {
  error?: string;
  paywall?: boolean;
  redirectTo?: string;
  diagnosticCode?: ImportDiagnosticCodeValue;
}

const USER_FACING_MESSAGE: Record<string, string> = {
  [ErrorCategory.INVALID_URL]: "Не распознал ссылку на YouTube-видео.",
  [ErrorCategory.VIDEO_UNAVAILABLE]: "Это видео недоступно (приватное, удалено или ограничено).",
  [ErrorCategory.VIDEO_TOO_LONG]: "Это видео слишком длинное для импорта.",
  [ErrorCategory.RATE_LIMITED]: "Слишком много попыток импорта. Попробуй через несколько минут.",
  [ErrorCategory.CAPTIONS_FAILED]: "Не удалось найти или распознать речь в этом видео.",
  [ErrorCategory.AUDIO_EXTRACTION_FAILED]: "Не удалось загрузить аудио этого видео. Попробуй другое видео.",
  [ErrorCategory.TRANSCRIPTION_FAILED]: "Не удалось распознать речь в этом видео.",
  [ErrorCategory.NO_SPEECH_DETECTED]: "Не удалось распознать речь в этом видео.",
  [ErrorCategory.TIMEOUT]: "Импорт занял слишком много времени. Попробуй ещё раз.",
  [ErrorCategory.WORKER_UNAVAILABLE]: "Сервис импорта временно недоступен. Попробуй чуть позже.",
  [ErrorCategory.STORAGE_FAILED]: "Не удалось сохранить импортированное видео. Попробуй ещё раз.",
};

function lifecycleDiagnostic(event: string, requestId: string, metadata: Record<string, unknown> = {}) {
  console.info(`[LexReader:diag] ${event}`, { requestId, ...metadata });
}

function toState(outcome: ImportOutcome): StartYoutubeImportState {
  if (outcome.status === "ready") {
    return { redirectTo: outcome.readyRoute };
  }
  if (outcome.status === "failed") {
    return {
      error: outcome.error ? (USER_FACING_MESSAGE[outcome.error] ?? "Не удалось импортировать видео.") : "Не удалось импортировать видео.",
      diagnosticCode: outcome.diagnosticCode,
    };
  }
  // pending/processing -- synchronous MVP (see service.ts's known
  // limitation note): by the time we get here the pipeline has already
  // been awaited to completion for THIS request, so reaching this branch
  // only happens for the "already in progress from another tab" case. No
  // polling UI exists yet (Video Reader is a later checkpoint), so this
  // surfaces as a plain retry-later message rather than a live status.
  return { error: "Импорт этого видео уже выполняется. Попробуй обновить страницу через минуту." };
}

/**
 * Persists a transcript the browser extension already extracted (M3 Slice
 * 12 Gate #2C -- browser bridge is now the primary path, see
 * docs/ui/m3-slice12-gate2c-*.md). The extension only acquires the
 * transcript; this is the one place that writes it to the DB, reusing the
 * exact same dedup/state-machine/persistence logic as the worker path by
 * handing runYoutubeImport() a synchronous callWorker that just wraps the
 * already-fetched result -- no import logic is duplicated (§9 of the brief).
 */
export async function startYoutubeImportFromBrowserAction(
  transcript: unknown,
  formData: FormData,
  requestId = "unknown",
): Promise<StartYoutubeImportState> {
  lifecycleDiagnostic("lexreader_persistence_started", requestId);
  const receivedMetadata = transcriptDiagnosticMetadata(transcript);
  lifecycleDiagnostic("server_action_received", requestId, receivedMetadata);
  let validated: TranscriptResult;
  try {
    assertValidTranscriptResult(transcript);
    validated = transcript;
    lifecycleDiagnostic("server_result_validation_passed", requestId, receivedMetadata);
  } catch (err) {
    lifecycleDiagnostic("server_result_validation_failed", requestId, {
      ...receivedMetadata,
      diagnosticCode: ImportDiagnosticCode.VALIDATION_FAILED,
    });
    lifecycleDiagnostic("lexreader_persistence_failure", requestId, {
      reason: "browser_payload_invalid",
      diagnosticCode: ImportDiagnosticCode.VALIDATION_FAILED,
    });
    log.import({ kind: "youtube", outcome: "error", reason: "browser_payload_invalid" });
    const state: StartYoutubeImportState = {
      error:
        err instanceof MalformedTranscriptError
          ? "Расширение вернуло некорректные субтитры."
          : "Не удалось получить субтитры через расширение.",
      diagnosticCode: ImportDiagnosticCode.VALIDATION_FAILED,
    };
    lifecycleDiagnostic("import_action_returned", requestId, {
      ok: false,
      diagnosticCode: state.diagnosticCode,
    });
    return state;
  }

  let profile: Awaited<ReturnType<typeof requireProfile>>;
  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    profile = await requireProfile();
    supabase = await createClient();
  } catch {
    lifecycleDiagnostic("lexreader_persistence_failure", requestId, {
      videoId: validated.videoId,
      reason: "auth_failed",
      diagnosticCode: ImportDiagnosticCode.AUTH_FAILED,
    });
    lifecycleDiagnostic("import_action_returned", requestId, {
      ok: false,
      diagnosticCode: ImportDiagnosticCode.AUTH_FAILED,
    });
    return {
      error: "Сессия устарела. Обнови страницу и войди снова.",
      diagnosticCode: ImportDiagnosticCode.AUTH_FAILED,
    };
  }

  if (!(await hasFreeTextRoom(supabase, profile.id))) {
    lifecycleDiagnostic("lexreader_persistence_failure", requestId, { reason: "paywall" });
    lifecycleDiagnostic("import_action_returned", requestId, { ok: false, reason: "paywall" });
    return { paywall: true };
  }

  const collectionAssignment = await resolveCollectionAssignment(
    supabase,
    profile.id,
    profile.target_language,
    formData,
  );
  if ("error" in collectionAssignment) {
    lifecycleDiagnostic("lexreader_persistence_failure", requestId, { reason: "collection_assignment" });
    lifecycleDiagnostic("import_action_returned", requestId, { ok: false, reason: "collection_assignment" });
    return { error: collectionAssignment.error };
  }

  const start = Date.now();
  try {
    const diagnostic = (event: string, metadata: Record<string, unknown> = {}) => {
      lifecycleDiagnostic(event, requestId, metadata);
    };
    const outcome = await runYoutubeImport(
      supabase,
      profile.id,
      `https://www.youtube.com/watch?v=${validated.videoId}`,
      profile.target_language,
      async () => ({
        ok: true,
        transcript: validated,
        attempts: [{ provider: "browser_bridge", outcome: "success" }],
        ingestionDurationMs: Date.now() - start,
      }),
      collectionAssignment,
      diagnostic,
    );
    if (outcome.status === "failed") {
      lifecycleDiagnostic("lexreader_persistence_failure", requestId, {
        videoId: validated.videoId,
        reason: outcome.error ?? "unknown",
        diagnosticCode: outcome.diagnosticCode,
      });
      log.import({ kind: "youtube", outcome: "error", reason: outcome.error ?? "unknown" });
    } else if (outcome.status === "ready") {
      lifecycleDiagnostic("lexreader_persistence_success", requestId, {
        videoId: validated.videoId,
        uniqueSegments: validated.segments.length,
        redirectTo: outcome.readyRoute,
      });
      log.import({ kind: "youtube", outcome: "success", reason: "browser_bridge" });
    }
    const state = toState(outcome);
    lifecycleDiagnostic("import_action_returned", requestId, {
      ok: Boolean(state.redirectTo),
      textId: outcome.textId || null,
      status: outcome.status,
      diagnosticCode: outcome.diagnosticCode,
      redirectTo: state.redirectTo ?? null,
    });
    return state;
  } catch (error) {
    const diagnosticCode = error instanceof YoutubeImportPersistenceError
      ? error.diagnosticCode
      : ImportDiagnosticCode.TRANSACTION_FAILED;
    const databaseCode = error instanceof YoutubeImportPersistenceError
      ? error.databaseCode
      : null;
    lifecycleDiagnostic("lexreader_persistence_failure", requestId, {
      videoId: validated.videoId,
      reason: diagnosticCode,
      diagnosticCode,
      databaseCode,
    });
    lifecycleDiagnostic("import_action_returned", requestId, {
      ok: false,
      diagnosticCode,
    });
    log.import({ kind: "youtube", outcome: "error", reason: diagnosticCode });
    return {
      error: "Не удалось импортировать видео. Попробуй ещё раз.",
      diagnosticCode,
    };
  }
}

export async function startYoutubeImportAction(
  _prevState: StartYoutubeImportState,
  formData: FormData,
): Promise<StartYoutubeImportState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!rawUrl) {
    return { error: "Вставь ссылку на видео YouTube." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  if (!(await hasFreeTextRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  const collectionAssignment = await resolveCollectionAssignment(
    supabase,
    profile.id,
    profile.target_language,
    formData,
  );
  if ("error" in collectionAssignment) {
    return { error: collectionAssignment.error };
  }

  try {
    const outcome = await runYoutubeImport(
      supabase,
      profile.id,
      rawUrl,
      profile.target_language,
      undefined,
      collectionAssignment,
    );
    if (outcome.status === "failed") {
      log.import({ kind: "youtube", outcome: "error", reason: outcome.error ?? "unknown" });
    } else if (outcome.status === "ready") {
      log.import({ kind: "youtube", outcome: "success", reason: "worker_pipeline" });
    }
    return toState(outcome);
  } catch {
    log.import({ kind: "youtube", outcome: "error", reason: "unexpected_exception" });
    return { error: "Не удалось импортировать видео. Попробуй ещё раз." };
  }
}
