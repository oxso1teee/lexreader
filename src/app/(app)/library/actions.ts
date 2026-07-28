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
    collectionId?: string | null;
    collectionOrder?: number | null;
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
      collection_id: params.collectionId ?? null,
      collection_order: params.collectionOrder ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Не удалось сохранить текст. Попробуй ещё раз." };
  }
  return { id: data.id };
}

// Идея из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.1): вместо
// хрупкого автосклеивания всех страниц сайта пользователь сам группирует
// главы книги/серии под одной коллекцией — работает для ЛЮБОГО источника
// импорта (текст/ссылка/YouTube/фото), не упирается в антибот/JS-сайты.
export async function getCollections(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<{ id: string; title: string }[]> {
  const { data } = await supabase
    .from("collections")
    .select("id, title")
    .eq("owner_id", ownerId)
    .eq("language", language)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function resolveCollectionId(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  formData: FormData,
): Promise<{ id: string | null } | { error: string }> {
  const newTitle = String(formData.get("new_collection_title") ?? "").trim();
  if (newTitle) {
    const { data, error } = await supabase
      .from("collections")
      .insert({ owner_id: ownerId, title: newTitle, language })
      .select("id")
      .single();
    if (error || !data) return { error: "Не удалось создать коллекцию." };
    return { id: data.id };
  }

  const existingId = String(formData.get("collection_id") ?? "").trim();
  if (existingId) {
    const { data } = await supabase
      .from("collections")
      .select("id")
      .eq("id", existingId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (!data) return { error: "Коллекция не найдена." };
    return { id: data.id };
  }

  return { id: null };
}

export async function nextCollectionOrder(
  supabase: SupabaseServerClient,
  collectionId: string,
): Promise<number> {
  const { count } = await supabase
    .from("texts")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", collectionId);
  return (count ?? 0) + 1;
}

// Общий шаг для всех форм импорта (текст/ссылка/YouTube/фото) — читает
// collection_id/new_collection_title из той же FormData, что и остальные
// поля формы, и возвращает готовые id+order для insertText().
export async function resolveCollectionAssignment(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  formData: FormData,
): Promise<{ collectionId: string | null; collectionOrder: number | null } | { error: string }> {
  const resolved = await resolveCollectionId(supabase, ownerId, language, formData);
  if ("error" in resolved) return resolved;
  if (!resolved.id) return { collectionId: null, collectionOrder: null };
  const order = await nextCollectionOrder(supabase, resolved.id);
  return { collectionId: resolved.id, collectionOrder: order };
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

  const collection = await resolveCollectionAssignment(supabase, profile.id, profile.target_language, formData);
  if ("error" in collection) return { error: collection.error };

  const result = await insertText(supabase, {
    ownerId: profile.id,
    title,
    body,
    sourceType: "manual",
    language: profile.target_language,
    collectionId: collection.collectionId,
    collectionOrder: collection.collectionOrder,
  });
  if ("error" in result) return { error: result.error };

  redirect(`/read/${result.id}`);
}

// Найдено при повторном аудите: некоторые сайты (особенно книги/фанфики)
// разбивают одну статью/главу на несколько страниц ("следующая глава" внизу)
// — раньше импортировался только текст той страницы, на которую вставили
// ссылку. rel="next" — стандартный, явный сигнал сайта "вот продолжение
// этого же материала", проверяем его первым (низкий риск ложного срабатывания).
const NEXT_LINK_TEXT_PATTERN =
  /^(next( chapter| page)?|»|→|>>|continue reading|следующ(ая|ая глава|ая страница))$/i;

function findNextPageUrl(document: Document, baseUrl: URL): URL | null {
  const relHref =
    document.querySelector('link[rel="next"]')?.getAttribute("href") ??
    document.querySelector('a[rel="next"]')?.getAttribute("href");
  if (relHref) {
    try {
      return new URL(relHref, baseUrl);
    } catch {
      /* falls through to text-based поиск ниже */
    }
  }

  // Многие книжные/фанфик-сайты вообще не проставляют rel="next" — обычная
  // ссылка "Next Chapter"/"Следующая глава" без этого атрибута. Это менее
  // надёжный сигнал (теоретически может увести на другую статью), но без
  // него импорт таких сайтов всегда останавливался бы на первой странице.
  for (const a of document.querySelectorAll("a[href]")) {
    const text = a.textContent?.trim().toLowerCase() ?? "";
    if (NEXT_LINK_TEXT_PATTERN.test(text)) {
      const href = a.getAttribute("href");
      if (!href) continue;
      try {
        return new URL(href, baseUrl);
      } catch {
        continue;
      }
    }
  }

  return null;
}

const MAX_PAGINATED_PAGES = 50;
const MAX_ARTICLE_BODY_LENGTH = 200_000;
// Оставляем запас под 45-секундный maxDuration страницы (library/new/page.tsx,
// поднят вместе с этим фиксом ради ScraperAPI-запроса в youtube-actions.ts):
// на последнюю обработанную страницу уже потрачено время, следующий фетч
// (до 10 сек) не должен вывалиться за лимит вместе с записью в БД и редиректом.
const PAGINATION_TIME_BUDGET_MS = 30_000;

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

  const startedAt = Date.now();
  const visited = new Set<string>();
  const bodyParts: string[] = [];
  let title: string | null = null;
  let currentUrl: URL | null = url;
  let pageCount = 0;

  while (currentUrl && pageCount < MAX_PAGINATED_PAGES && !visited.has(currentUrl.toString())) {
    visited.add(currentUrl.toString());

    let html: string;
    try {
      const res = await fetchPublicUrl(currentUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; LexReaderBot/1.0)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`страница ответила ${res.status}`);
      html = await res.text();
    } catch {
      if (pageCount === 0) {
        log.import({ kind: "url", outcome: "error", reason: "fetch_failed" });
        return { error: "Не удалось загрузить страницу. Проверь ссылку и попробуй ещё раз." };
      }
      break; // уже что-то собрали — отдаём собранное, а не всё роняем
    }

    // Найдено при повторном аудите: jsdom тянет транзитивные ESM-only пакеты
    // (html-encoding-sniffer -> @exodus/bytes, cssstyle -> @asamuzakjp/css-color
    // -> @csstools/css-calc), которые падают с ERR_REQUIRE_ESM в проде — Next.js
    // грузит jsdom как "external" через нативный require(). linkedom — лёгкая
    // DOM-реализация без CSS-движка и без этой цепочки зависимостей, достаточная
    // для Readability (нам нужен только article.textContent, без CSS/картинок).
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    const pageBody = article?.textContent?.trim();
    if (!article || !pageBody) {
      if (pageCount === 0) {
        log.import({ kind: "url", outcome: "error", reason: "extraction_failed" });
        return { error: "Не удалось извлечь текст статьи со страницы." };
      }
      break;
    }

    if (!title) title = article.title?.trim() || currentUrl.hostname;
    bodyParts.push(pageBody);
    pageCount++;

    const combinedLength = bodyParts.reduce((n, p) => n + p.length, 0);
    if (combinedLength >= MAX_ARTICLE_BODY_LENGTH) break;
    if (Date.now() - startedAt >= PAGINATION_TIME_BUDGET_MS) break;

    currentUrl = findNextPageUrl(document, currentUrl);
  }

  const body = bodyParts.join("\n\n").trim().slice(0, MAX_ARTICLE_BODY_LENGTH);

  const collection = await resolveCollectionAssignment(supabase, profile.id, profile.target_language, formData);
  if ("error" in collection) {
    log.import({ kind: "url", outcome: "error", reason: "insert_failed" });
    return { error: collection.error };
  }

  const result = await insertText(supabase, {
    ownerId: profile.id,
    title: title ?? url.hostname,
    body,
    sourceType: "article_url",
    sourceUrl: url.toString(),
    language: profile.target_language,
    collectionId: collection.collectionId,
    collectionOrder: collection.collectionOrder,
  });
  if ("error" in result) {
    log.import({ kind: "url", outcome: "error", reason: "insert_failed" });
    return { error: result.error };
  }

  log.import({ kind: "url", outcome: "success" });
  redirect(`/read/${result.id}`);
}
