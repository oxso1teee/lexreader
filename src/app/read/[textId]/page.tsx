import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import type { LearningState } from "@/lib/vocabulary-list";
import { tokenizeSentence, splitIntoSentences } from "@/lib/tokenize";
import { hasSavedReaderPrefs, parseReaderPrefs } from "./reader-prefs";
import Reader from "./reader";

export default async function ReadPage({
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

  if (!text) {
    notFound();
  }

  const [{ data: savedWords }, { data: progress }, { data: collection }, { data: siblingRows }] =
    await Promise.all([
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
      // M3 Slice 3: chapter navigation uses the existing collection_id/
      // collection_order columns — no schema change (plan doc §5).
      text.collection_id
        ? supabase.from("collections").select("title").eq("id", text.collection_id).maybeSingle()
        : Promise.resolve({ data: null }),
      text.collection_id
        ? supabase
            .from("texts")
            .select("id, collection_order")
            .eq("collection_id", text.collection_id)
            .order("collection_order", { ascending: true })
        : Promise.resolve({ data: null }),
    ]);

  const siblings = siblingRows ?? [];
  const myIndex = siblings.findIndex((s) => s.id === text.id);
  const chapter =
    text.collection_id && myIndex >= 0
      ? {
          collectionTitle: collection?.title ?? "Коллекция",
          position: myIndex + 1,
          total: siblings.length,
          prevTextId: myIndex > 0 ? siblings[myIndex - 1].id : null,
          nextTextId: myIndex < siblings.length - 1 ? siblings[myIndex + 1].id : null,
        }
      : null;

  // M3 Slice 11 (plan doc §2, Practice Bridge) — vocabulary_items.flashcard_id already links
  // every reading word to its real flashcard (migration 0028, populated by
  // saveVocabularyItem→linkToFlashcard). No new schema: joining it here is what lets the
  // reading surface finally show the *real* learning_state (Slice 10) instead of only the
  // legacy self-reported 0-4 level.
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

  const uniqueTokens = new Set<string>();
  for (const sentence of splitIntoSentences(text.body)) {
    for (const tok of tokenizeSentence(sentence)) {
      if (tok.isWord) uniqueTokens.add(tok.text.toLowerCase());
    }
  }

  let statsNew = 0;
  let statsLearning = 0;
  let statsFamiliar = 0;
  let statsKnown = 0;
  for (const word of uniqueTokens) {
    const saved = wordLevels[word];
    if (!saved) continue;
    if (saved.level >= 4) statsKnown++;
    else if (saved.level === 3) statsFamiliar++;
    else if (saved.level >= 1) statsLearning++;
    else statsNew++;
  }

  const initialServerPrefs = hasSavedReaderPrefs(profile.reader_settings)
    ? parseReaderPrefs(profile.reader_settings)
    : null;

  return (
    <Reader
      textId={text.id}
      title={text.title}
      body={text.body}
      sourceLang={text.language}
      targetLang={profile.native_language}
      wordLevels={wordLevels}
      initialPageIndex={progress?.last_page_index ?? 0}
      initialServerPrefs={initialServerPrefs}
      chapter={chapter}
      stats={{
        unique: uniqueTokens.size,
        new: statsNew,
        learning: statsLearning,
        familiar: statsFamiliar,
        known: statsKnown,
      }}
    />
  );
}
