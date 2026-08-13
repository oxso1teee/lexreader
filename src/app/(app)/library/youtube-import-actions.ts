"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasFreeTextRoom, resolveCollectionAssignment } from "./actions";
import { runYoutubeImport } from "@/lib/youtube-ingestion/service";
import { ErrorCategory, type ImportOutcome } from "@/lib/youtube-ingestion/types";
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

function toState(outcome: ImportOutcome): StartYoutubeImportState {
  if (outcome.status === "ready") {
    return { redirectTo: outcome.readyRoute };
  }
  if (outcome.status === "failed") {
    return { error: outcome.error ? (USER_FACING_MESSAGE[outcome.error] ?? "Не удалось импортировать видео.") : "Не удалось импортировать видео." };
  }
  // pending/processing -- synchronous MVP (see service.ts's known
  // limitation note): by the time we get here the pipeline has already
  // been awaited to completion for THIS request, so reaching this branch
  // only happens for the "already in progress from another tab" case. No
  // polling UI exists yet (Video Reader is a later checkpoint), so this
  // surfaces as a plain retry-later message rather than a live status.
  return { error: "Импорт этого видео уже выполняется. Попробуй обновить страницу через минуту." };
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
