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

// Официальный YouTube Data API v3 требует OAuth для скачивания субтитров
// чужого видео (раздел 7 ТЗ) — неподъёмно для MVP. Вместо этого парсим
// страницу просмотра, как это делают публичные транскрипт-инструменты:
// неофициальный способ, может сломаться при изменениях вёрстки YouTube,
// работает только для видео с открытыми субтитрами.

// Найдено при повторном аудите: YouTube отдаёт страницу просмотра БЕЗ
// captionTracks (хотя сама страница грузится нормально) запросам с IP
// серверов облачных провайдеров (Vercel и т.п.) — это IP-репутационная
// антибот-проверка, не лечится никакими заголовками/куки (проверено на
// нескольких открытых библиотеках с той же техникой). Если задан
// SCRAPERAPI_KEY, прогоняем именно этот запрос через ScraperAPI (ротация
// не-датацентровых IP) — без ключа тихо откатываемся на прямой fetch, как
// было раньше, просто с тем же шансом наткнуться на блокировку.
async function fetchWatchPage(targetUrl: string): Promise<Response> {
  const apiKey = process.env.SCRAPERAPI_KEY;
  if (apiKey) {
    const proxied = `https://api.scraperapi.com/?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}`;
    return fetch(proxied, { signal: AbortSignal.timeout(20_000) });
  }
  return fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: "CONSENT=YES+cb",
    },
    signal: AbortSignal.timeout(10_000),
  });
}

function extractVideoId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return url.pathname.slice(1) || null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const shortsMatch = url.pathname.match(/^\/shorts\/([\w-]+)/);
    if (shortsMatch) return shortsMatch[1];
    const embedMatch = url.pathname.match(/^\/embed\/([\w-]+)/);
    if (embedMatch) return embedMatch[1];
  }
  return null;
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
}

function findCaptionTracks(html: string): CaptionTrack[] {
  const match = html.match(/"captionTracks":(\[.*?\])(?=,")/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]) as CaptionTrack[];
  } catch {
    return [];
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#")) {
      const num = Number(code.slice(1));
      return Number.isFinite(num) ? String.fromCharCode(num) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

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

function parseAttr(attrs: string, name: string): number | null {
  const m = attrs.match(new RegExp(`${name}="([\\d.]+)"`));
  return m ? parseFloat(m[1]) : null;
}

function parseTimedTextSegments(xml: string): CaptionSegment[] {
  const matches = [...xml.matchAll(/<text\s+([^>]*)>([\s\S]*?)<\/text>/g)];
  const segments: CaptionSegment[] = [];
  for (const m of matches) {
    const start = parseAttr(m[1], "start");
    if (start === null) continue;
    const dur = parseAttr(m[1], "dur") ?? 2;
    const body = decodeEntities(m[2].replace(/<[^>]+>/g, "")).trim();
    if (!body) continue;
    const startMs = Math.round(start * 1000);
    segments.push({ startMs, endMs: startMs + Math.round(dur * 1000), body });
  }
  return segments;
}

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

export async function createTextFromYoutube(
  _prevState: CreateTextState,
  formData: FormData,
): Promise<YoutubeImportState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!rawUrl) {
    return { error: "Вставь ссылку на видео YouTube." };
  }

  const videoId = extractVideoId(rawUrl);
  if (!videoId) {
    return { error: "Не распознал ссылку на YouTube-видео." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  if (!(await hasFreeTextRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  let watchHtml: string;
  try {
    const res = await fetchWatchPage(`https://www.youtube.com/watch?v=${videoId}`);
    if (!res.ok) throw new Error(`видео ответило ${res.status}`);
    watchHtml = await res.text();
  } catch {
    log.import({ kind: "youtube", outcome: "error", reason: "watch_page_fetch_failed" });
    return { error: "Не удалось загрузить видео. Проверь ссылку и попробуй ещё раз." };
  }

  const titleMatch = watchHtml.match(/<meta name="title" content="([^"]*)"/);
  const title = titleMatch ? decodeEntities(titleMatch[1]) : `YouTube ${videoId}`;

  const tracks = findCaptionTracks(watchHtml);
  if (tracks.length === 0) {
    log.import({ kind: "youtube", outcome: "error", reason: "no_captions" });
    return { error: "У этого видео нет открытых субтитров — импорт доступен только для видео с субтитрами." };
  }

  const preferred =
    tracks.find((t) => t.languageCode?.startsWith(profile.target_language)) ?? tracks[0];

  let captionXml: string;
  try {
    const res = await fetch(preferred.baseUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`субтитры ответили ${res.status}`);
    captionXml = await res.text();
  } catch {
    log.import({ kind: "youtube", outcome: "error", reason: "caption_fetch_failed" });
    return { error: "Не удалось загрузить субтитры. Попробуй ещё раз." };
  }

  if (!captionXml.trim()) {
    log.import({ kind: "youtube", outcome: "error", reason: "empty_caption_response" });
    return {
      error:
        "YouTube не отдал субтитры для этого видео с текущего сервера (иногда временно ограничивает доступ ботам). Попробуй другое видео или повтори позже.",
    };
  }

  const segments = parseTimedTextSegments(captionXml);
  if (segments.length === 0) {
    log.import({ kind: "youtube", outcome: "error", reason: "parse_failed" });
    return { error: "Не удалось разобрать субтитры этого видео." };
  }

  const collection = await resolveCollectionAssignment(supabase, profile.id, profile.target_language, formData);
  if ("error" in collection) {
    log.import({ kind: "youtube", outcome: "error", reason: "insert_failed" });
    return { error: collection.error };
  }

  const saved = await persistYoutubeTranscript({
    profile,
    supabase,
    videoId,
    title,
    segments,
    collectionId: collection.collectionId,
    collectionOrder: collection.collectionOrder,
  });
  if ("error" in saved) return { error: saved.error };

  log.import({ kind: "youtube", outcome: "success" });
  return { redirectTo: `/watch/${saved.id}` };
}
