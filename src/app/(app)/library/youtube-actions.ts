"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasFreeTextRoom, insertText, type CreateTextState } from "./actions";
import { log } from "@/lib/log";

// Официальный YouTube Data API v3 требует OAuth для скачивания субтитров
// чужого видео (раздел 7 ТЗ) — неподъёмно для MVP. Вместо этого парсим
// страницу просмотра, как это делают публичные транскрипт-инструменты:
// неофициальный способ, может сломаться при изменениях вёрстки YouTube,
// работает только для видео с открытыми субтитрами.

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

export async function createTextFromYoutube(
  _prevState: CreateTextState,
  formData: FormData,
): Promise<CreateTextState> {
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
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`видео ответило ${res.status}`);
    watchHtml = await res.text();
  } catch (e) {
    log.import({ kind: "youtube", outcome: "error", reason: "watch_page_fetch_failed" });
    return {
      error: `Не удалось загрузить видео: ${e instanceof Error ? e.message : "ошибка сети"}`,
    };
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
  } catch (e) {
    log.import({ kind: "youtube", outcome: "error", reason: "caption_fetch_failed" });
    return {
      error: `Не удалось загрузить субтитры: ${e instanceof Error ? e.message : "ошибка сети"}`,
    };
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

  const body = segments.map((s) => s.body).join(" ");

  const result = await insertText(supabase, {
    ownerId: profile.id,
    title,
    body,
    sourceType: "youtube",
    sourceUrl: `https://www.youtube.com/watch?v=${videoId}`,
    language: profile.target_language,
    youtubeVideoId: videoId,
  });
  if ("error" in result) {
    log.import({ kind: "youtube", outcome: "error", reason: "insert_failed" });
    return { error: result.error };
  }

  const { error: segmentsError } = await supabase.from("caption_segments").insert(
    segments.map((s, i) => ({
      text_id: result.id,
      start_ms: s.startMs,
      end_ms: s.endMs,
      body: s.body,
      segment_index: i,
    })),
  );
  if (segmentsError) {
    log.import({ kind: "youtube", outcome: "error", reason: "segments_insert_failed" });
    return { error: segmentsError.message };
  }

  log.import({ kind: "youtube", outcome: "success" });
  redirect(`/watch/${result.id}`);
}
