"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getPlan, FREE_TEXT_LIMIT } from "@/lib/subscription";
import { assertPublicUrl, fetchPublicUrl } from "@/lib/ssrf-guard";
import type { TextSourceType } from "@/lib/types";
import { log } from "@/lib/log";

export async function deleteText(textId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("texts").delete().eq("id", textId);
  if (error) throw new Error("Не удалось удалить текст.");
  revalidatePath("/library");
}

export interface CreateTextState {
  error?: string;
  paywall?: boolean;
}

export async function hasFreeTextRoom(
  supabase: SupabaseServerClient,
  ownerId: string,
): Promise<boolean> {
  const plan = await getPlan(supabase, ownerId);
  if (plan !== "free") return true;

  const { count } = await supabase
    .from("texts")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId);
  return (count ?? 0) < FREE_TEXT_LIMIT;
}

export async function insertText(
  supabase: SupabaseServerClient,
  params: {
    ownerId: string;
    title: string;
    body: string;
    sourceType: TextSourceType;
    sourceUrl?: string;
    language: string;
    youtubeVideoId?: string;
  },
): Promise<{ id: string } | { error: string }> {
  const wordCount = params.body.split(/\s+/).filter(Boolean).length;

  const { data, error } = await supabase
    .from("texts")
    .insert({
      owner_id: params.ownerId,
      title: params.title,
      body: params.body,
      source_type: params.sourceType,
      source_url: params.sourceUrl ?? null,
      language: params.language,
      word_count: wordCount,
      youtube_video_id: params.youtubeVideoId ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Не удалось сохранить текст. Попробуй ещё раз." };
  }
  return { id: data.id };
}

export async function createText(
  _prevState: CreateTextState,
  formData: FormData,
): Promise<CreateTextState> {
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) {
    return { error: "Заполни название и текст." };
  }
  // P0-АУДИТ (раздел 5): не было верхней границы на длину вставляемого
  // текста — read/[textId]/page.tsx пересчитывает статистику по всему телу
  // текста на каждую загрузку страницы.
  if (body.length > 200_000) {
    return { error: "Текст слишком длинный (максимум 200 000 символов)." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  if (!(await hasFreeTextRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  const result = await insertText(supabase, {
    ownerId: profile.id,
    title,
    body,
    sourceType: "manual",
    language: profile.target_language,
  });
  if ("error" in result) return { error: result.error };

  redirect(`/read/${result.id}`);
}

export async function createTextFromUrl(
  _prevState: CreateTextState,
  formData: FormData,
): Promise<CreateTextState> {
  const rawUrl = String(formData.get("url") ?? "").trim();
  if (!rawUrl) {
    return { error: "Вставь ссылку на статью." };
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { error: "Некорректная ссылка." };
  }

  try {
    await assertPublicUrl(url);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Некорректная ссылка." };
  }

  const profile = await requireProfile();
  const supabase = await createClient();

  if (!(await hasFreeTextRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  let html: string;
  try {
    const res = await fetchPublicUrl(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LexReaderBot/1.0)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`страница ответила ${res.status}`);
    html = await res.text();
  } catch {
    log.import({ kind: "url", outcome: "error", reason: "fetch_failed" });
    return { error: "Не удалось загрузить страницу. Проверь ссылку и попробуй ещё раз." };
  }

  // Найдено при повторном аудите: jsdom тянет транзитивные ESM-only пакеты
  // (html-encoding-sniffer -> @exodus/bytes, cssstyle -> @asamuzakjp/css-color
  // -> @csstools/css-calc), которые падают с ERR_REQUIRE_ESM в проде — Next.js
  // грузит jsdom как "external" через нативный require(). linkedom — лёгкая
  // DOM-реализация без CSS-движка и без этой цепочки зависимостей, достаточная
  // для Readability (нам нужен только article.textContent, без CSS/картинок).
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document).parse();
  const body = article?.textContent?.trim();
  if (!article || !body) {
    log.import({ kind: "url", outcome: "error", reason: "extraction_failed" });
    return { error: "Не удалось извлечь текст статьи со страницы." };
  }

  const result = await insertText(supabase, {
    ownerId: profile.id,
    title: article.title?.trim() || url.hostname,
    body,
    sourceType: "article_url",
    sourceUrl: url.toString(),
    language: profile.target_language,
  });
  if ("error" in result) {
    log.import({ kind: "url", outcome: "error", reason: "insert_failed" });
    return { error: result.error };
  }

  log.import({ kind: "url", outcome: "success" });
  redirect(`/read/${result.id}`);
}
