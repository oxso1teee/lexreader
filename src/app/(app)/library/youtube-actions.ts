"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import {
  hasFreeTextRoom,
  insertText,
  resolveCollectionAssignment,
  type CreateTextState,
} from "./actions";
import { log } from "@/lib/log";
import { captureServerException } from "@/lib/posthog-server";

// Tier 0: the browser-extension bridge path below (saveBrowserYoutubeTranscript)
// reads captions through the user's own browser session -- the only
// synchronous, client-side transcript source. The former server-side
// "fetch the watch page and scrape captionTracks" fallback that used to
// live in this file was replaced by the worker-backed pipeline in
// src/lib/youtube-ingestion/ (Slice 12) precisely because it broke under
// cloud-provider IP-reputation blocking; see
// docs/ui/m3-slice12-production-architecture.md.

interface CaptionSegment {
  startMs: number;
  endMs: number;
  body: string;
}

export interface BrowserYoutubeTranscript {
  videoId: string;
  title: string;
  languageCode: string;
  segments: CaptionSegment[];
}

export interface YoutubeImportState extends CreateTextState {
  redirectTo?: string;
}

const MAX_BROWSER_SEGMENTS = 10_000;
const MAX_TRANSCRIPT_LENGTH = 200_000;
const MAX_SEGMENT_LENGTH = 2_000;

function validateBrowserTranscript(
  input: unknown,
): { transcript: BrowserYoutubeTranscript } | { error: string } {
  if (!input || typeof input !== "object") {
    return { error: "Расширение вернуло некорректные субтитры." };
  }

  const value = input as Partial<BrowserYoutubeTranscript>;
  const videoId = typeof value.videoId === "string" ? value.videoId.trim() : "";
  if (!/^[\w-]{6,20}$/.test(videoId)) {
    return { error: "Расширение вернуло некорректный ID видео." };
  }

  const title =
    typeof value.title === "string"
      ? value.title.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 300)
      : "";
  const languageCode =
    typeof value.languageCode === "string" && /^[a-zA-Z0-9-]{1,20}$/.test(value.languageCode)
      ? value.languageCode
      : "und";

  if (!Array.isArray(value.segments) || value.segments.length === 0) {
    return { error: "Расширение не нашло субтитры у этого видео." };
  }
  if (value.segments.length > MAX_BROWSER_SEGMENTS) {
    return { error: "Субтитры этого видео слишком длинные для импорта." };
  }

  const segments: CaptionSegment[] = [];
  let totalLength = 0;
  for (const rawSegment of value.segments) {
    if (!rawSegment || typeof rawSegment !== "object") {
      return { error: "Расширение вернуло повреждённый фрагмент субтитров." };
    }

    const candidate = rawSegment as Partial<CaptionSegment>;
    const startMs = candidate.startMs;
    const endMs = candidate.endMs;
    const body =
      typeof candidate.body === "string" ? candidate.body.replace(/\s+/g, " ").trim() : "";

    if (
      !Number.isSafeInteger(startMs) ||
      !Number.isSafeInteger(endMs) ||
      (startMs as number) < 0 ||
      (endMs as number) <= (startMs as number) ||
      !body ||
      body.length > MAX_SEGMENT_LENGTH
    ) {
      return { error: "Расширение вернуло повреждённый фрагмент субтитров." };
    }

    totalLength += body.length + 1;
    if (totalLength > MAX_TRANSCRIPT_LENGTH) {
      return { error: "Субтитры этого видео слишком длинные для импорта." };
    }

    segments.push({ startMs: startMs as number, endMs: endMs as number, body });
  }

  segments.sort((a, b) => a.startMs - b.startMs);
  return {
    transcript: {
      videoId,
      title: title || `YouTube ${videoId}`,
      languageCode,
      segments,
    },
  };
}

async function persistYoutubeTranscript(params: {
  profile: Awaited<ReturnType<typeof requireProfile>>;
  supabase: Awaited<ReturnType<typeof createClient>>;
  videoId: string;
  title: string;
  segments: CaptionSegment[];
  collectionId?: string | null;
  collectionOrder?: number | null;
}): Promise<{ id: string } | { error: string }> {
  const body = params.segments.map((segment) => segment.body).join(" ");
  const result = await insertText(params.supabase, {
    ownerId: params.profile.id,
    title: params.title,
    body,
    sourceType: "youtube",
    sourceUrl: `https://www.youtube.com/watch?v=${params.videoId}`,
    language: params.profile.target_language,
    youtubeVideoId: params.videoId,
    collectionId: params.collectionId,
    collectionOrder: params.collectionOrder,
  });
  if ("error" in result) {
    log.import({ kind: "youtube", outcome: "error", reason: "insert_failed" });
    captureServerException(new Error(result.error), params.profile.id, {
      kind: "youtube",
      reason: "insert_failed",
    });
    return { error: result.error };
  }

  const { error: segmentsError } = await params.supabase.from("caption_segments").insert(
    params.segments.map((segment, index) => ({
      text_id: result.id,
      start_ms: segment.startMs,
      end_ms: segment.endMs,
      body: segment.body,
      segment_index: index,
    })),
  );
  if (segmentsError) {
    log.import({ kind: "youtube", outcome: "error", reason: "segments_insert_failed" });
    captureServerException(new Error(segmentsError.message), params.profile.id, {
      kind: "youtube",
      reason: "segments_insert_failed",
    });
    await params.supabase.from("texts").delete().eq("id", result.id);
    return { error: "Не удалось сохранить субтитры этого видео. Попробуй ещё раз." };
  }

  return { id: result.id };
}

export async function saveBrowserYoutubeTranscript(
  input: unknown,
  formData?: FormData,
): Promise<YoutubeImportState> {
  const validated = validateBrowserTranscript(input);
  if ("error" in validated) {
    log.import({ kind: "youtube", outcome: "error", reason: "browser_payload_invalid" });
    return { error: validated.error };
  }

  const profile = await requireProfile();
  const supabase = await createClient();
  if (!(await hasFreeTextRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  const collection = formData
    ? await resolveCollectionAssignment(supabase, profile.id, profile.target_language, formData)
    : { collectionId: null, collectionOrder: null };
  if ("error" in collection) return { error: collection.error };

  const saved = await persistYoutubeTranscript({
    profile,
    supabase,
    videoId: validated.transcript.videoId,
    title: validated.transcript.title,
    segments: validated.transcript.segments,
    collectionId: collection.collectionId,
    collectionOrder: collection.collectionOrder,
  });
  if ("error" in saved) return { error: saved.error };

  log.import({ kind: "youtube", outcome: "success", reason: "browser_bridge" });
  return { redirectTo: `/watch/${saved.id}` };
}
