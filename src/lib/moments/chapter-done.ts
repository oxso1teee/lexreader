import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ChapterDoneMoment } from "./types";
import { splitIntoSentences, tokenizeSentence } from "../tokenize.ts";

/** Последние ~180 символов текста, обрезанные по началу предложения —
 *  «страница» в книжке на экране Chapter-done. */
export function chapterExcerpt(body: string, max = 180): string {
  const clean = body.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const tail = clean.slice(-max);
  const cut = tail.search(/[.!?…]\s+\S/);
  return (cut >= 0 && cut < max - 40 ? tail.slice(cut + 1) : tail).trim();
}

/** «Понимание»: доля уникальных слов текста, которые читатель НЕ открывал
 *  переводом. Чистая функция — покрыта тестами. */
export function comprehensionPercent(body: string, lookups: number): number {
  const unique = new Set<string>();
  for (const sentence of splitIntoSentences(body)) {
    for (const token of tokenizeSentence(sentence)) if (token.isWord) unique.add(token.text.toLowerCase());
  }
  if (unique.size === 0) return 0;
  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.min(lookups, unique.size) / unique.size))));
}

// docs/moments/ROADMAP.md, этап 4 — Chapter-done. "Глава" = один текст
// внутри коллекции, позиция — texts.collection_order, тот же честный приём,
// что уже использует welcome-back-actions.ts для continueChapter. Тексты
// без collection_id (не входят ни в какую коллекцию) — не "глава", момент
// не показывается.
export async function checkChapterDone(
  supabase: SupabaseServerClient,
  userId: string,
  textId: string,
  sessionStartedAt: Date,
  sessionEndedAt: Date,
): Promise<ChapterDoneMoment | null> {
  const { data: progress } = await supabase
    .from("text_progress")
    .select("percent_read, chapter_done_shown_at")
    .eq("owner_id", userId)
    .eq("text_id", textId)
    .maybeSingle();
  if (!progress || progress.percent_read < 100 || progress.chapter_done_shown_at) return null;

  const { data: text } = await supabase
    .from("texts")
    .select("title, body, word_count, collection_id, collection_order, language")
    .eq("id", textId)
    .maybeSingle();
  if (!text || !text.collection_id) return null;

  const [{ data: collection }, { data: siblings }, { data: sessions }, { data: newWordRows, count: newWordsCount }] = await Promise.all([
    supabase.from("collections").select("title").eq("id", text.collection_id).maybeSingle(),
    supabase
      .from("texts")
      .select("id, collection_order")
      .eq("collection_id", text.collection_id)
      .order("collection_order", { ascending: true }),
    supabase.from("reading_sessions").select("words_looked_up").eq("owner_id", userId).eq("text_id", textId),
    supabase
      .from("vocabulary_items")
      .select("headword", { count: "exact" })
      .eq("owner_id", userId)
      .eq("language", text.language)
      .gte("created_at", sessionStartedAt.toISOString())
      .lte("created_at", sessionEndedAt.toISOString())
      .order("created_at", { ascending: true })
      .limit(4),
  ]);

  const ordered = siblings ?? [];
  const position = ordered.findIndex((s) => s.id === textId);
  if (position < 0) return null;
  const nextTextId = ordered[position + 1]?.id ?? null;
  // Слов прочитано — длина текста (texts.word_count), а не число подсказок.
  const lookups = (sessions ?? []).reduce((sum, s) => sum + (s.words_looked_up ?? 0), 0);
  const body = (text.body as string | null) ?? "";
  const wordsRead = (text.word_count as number | null) ?? body.split(/\s+/).filter(Boolean).length;

  await supabase
    .from("text_progress")
    .update({ chapter_done_shown_at: new Date().toISOString() })
    .eq("owner_id", userId)
    .eq("text_id", textId);

  return {
    kind: "chapter_done",
    id: `chapter-done-${userId}-${textId}`,
    textTitle: text.title,
    collectionTitle: collection?.title ?? text.title,
    chapterPosition: position + 1,
    wordsRead,
    newWordsCount: newWordsCount ?? 0,
    newWords: (newWordRows ?? []).map((r) => r.headword as string).filter(Boolean),
    comprehension: comprehensionPercent(body, lookups),
    excerpt: chapterExcerpt(body),
    nextTextId,
  };
}
