import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import type { LearningState } from "@/lib/vocabulary-list";
import { clampResumeIndex } from "@/lib/video-reader/segment-lookup";
import WatchPlayer from "./watch-player";

export default async function WatchPage({
  params,
}: {
  params: Promise<{ textId: string }>;
}) {
  const { textId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: text } = await supabase
    .from("texts")
    .select("*")
    .eq("id", textId)
    .maybeSingle<TextRow>();

  if (!text || !text.youtube_video_id) {
    notFound();
  }

  const [{ data: segmentRows }, { data: savedWords }, { data: progress }] = await Promise.all([
    supabase
      .from("caption_segments")
      .select("id, start_ms, end_ms, body")
      .eq("text_id", textId)
      .order("segment_index", { ascending: true }),
    supabase
      .from("vocabulary_items")
      .select("id, headword, level, seen_count, flashcard_id")
      .eq("owner_id", profile.id)
      .eq("language", text.language),
    supabase
      .from("text_progress")
      .select("last_page_index")
      .eq("owner_id", profile.id)
      .eq("text_id", textId)
      .maybeSingle(),
  ]);

  const segments = segmentRows ?? [];

  // M3 Slice 12 Gate #3 — same Practice Bridge join Reader v2 already does (read/[textId]/page.tsx):
  // vocabulary_items.flashcard_id links every saved word to its real flashcard, so the word panel
  // can show the actual learning_state instead of only the legacy 0-4 level.
  const flashcardIds = (savedWords ?? [])
    .map((w) => w.flashcard_id)
    .filter((id): id is string => Boolean(id));
  const [{ data: linkedFlashcards }, { data: contextRows }] =
    flashcardIds.length > 0
      ? await Promise.all([
          supabase.from("flashcards").select("id, learning_state, deck_id").in("id", flashcardIds),
          supabase.from("vocabulary_contexts").select("flashcard_id").in("flashcard_id", flashcardIds),
        ])
      : [{ data: [] as { id: string; learning_state: string; deck_id: string }[] }, { data: [] as { flashcard_id: string }[] }];

  const flashcardById = new Map((linkedFlashcards ?? []).map((f) => [f.id, f]));
  const contextCountByFlashcard = new Map<string, number>();
  for (const row of contextRows ?? []) {
    contextCountByFlashcard.set(row.flashcard_id, (contextCountByFlashcard.get(row.flashcard_id) ?? 0) + 1);
  }

  const wordLevels: Record<
    string,
    {
      id: string;
      level: number;
      seenCount: number;
      flashcardId: string | null;
      deckId: string | null;
      learningState: LearningState | null;
      contextCount: number;
    }
  > = {};
  for (const w of savedWords ?? []) {
    const flashcard = w.flashcard_id ? flashcardById.get(w.flashcard_id) : undefined;
    wordLevels[w.headword.toLowerCase()] = {
      id: w.id,
      level: w.level,
      seenCount: w.seen_count,
      flashcardId: w.flashcard_id,
      deckId: flashcard?.deck_id ?? null,
      learningState: (flashcard?.learning_state as LearningState | undefined) ?? null,
      contextCount: w.flashcard_id ? (contextCountByFlashcard.get(w.flashcard_id) ?? 0) : 0,
    };
  }

  return (
    <WatchPlayer
      textId={text.id}
      title={text.title}
      videoId={text.youtube_video_id}
      segments={segments.map((s) => ({
        id: s.id,
        startMs: s.start_ms,
        endMs: s.end_ms,
        body: s.body,
      }))}
      sourceLang={text.language}
      targetLang={profile.native_language}
      wordLevels={wordLevels}
      initialActiveIndex={clampResumeIndex(progress?.last_page_index, segments.length)}
      durationSeconds={text.youtube_duration_seconds}
      transcriptSource={text.transcript_source}
      processingStatus={text.processing_status}
    />
  );
}
