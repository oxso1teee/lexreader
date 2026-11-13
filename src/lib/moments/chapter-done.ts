import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { ChapterDoneMoment } from "./types";

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
    .select("title, collection_id, collection_order, language")
    .eq("id", textId)
    .maybeSingle();
  if (!text || !text.collection_id) return null;

  const [{ data: collection }, { data: siblings }, { data: sessions }, { count: newWordsCount }] = await Promise.all([
    supabase.from("collections").select("title").eq("id", text.collection_id).maybeSingle(),
    supabase
      .from("texts")
      .select("id, collection_order")
      .eq("collection_id", text.collection_id)
      .order("collection_order", { ascending: true }),
    supabase.from("reading_sessions").select("words_looked_up").eq("owner_id", userId).eq("text_id", textId),
    supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .eq("language", text.language)
      .gte("created_at", sessionStartedAt.toISOString())
      .lte("created_at", sessionEndedAt.toISOString()),
  ]);

  const ordered = siblings ?? [];
  const position = ordered.findIndex((s) => s.id === textId);
  if (position < 0) return null;
  const nextTextId = ordered[position + 1]?.id ?? null;
  const wordsRead = (sessions ?? []).reduce((sum, s) => sum + (s.words_looked_up ?? 0), 0);

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
    nextTextId,
  };
}
