import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
import { tokenizeSentence, splitIntoSentences } from "@/lib/tokenize";
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

  const [{ data: savedWords }, { data: progress }] = await Promise.all([
    supabase
      .from("vocabulary_items")
      .select("id, headword, level, seen_count")
      .eq("owner_id", profile.id),
    supabase
      .from("text_progress")
      .select("last_page_index")
      .eq("owner_id", profile.id)
      .eq("text_id", textId)
      .maybeSingle(),
  ]);

  const wordLevels: Record<string, { id: string; level: number; seenCount: number }> = {};
  for (const w of savedWords ?? []) {
    wordLevels[w.headword.toLowerCase()] = { id: w.id, level: w.level, seenCount: w.seen_count };
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

  return (
    <Reader
      textId={text.id}
      title={text.title}
      body={text.body}
      sourceLang={text.language}
      targetLang={profile.native_language}
      wordLevels={wordLevels}
      initialPageIndex={progress?.last_page_index ?? 0}
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
