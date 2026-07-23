import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import type { TextRow } from "@/lib/types";
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

  const [{ data: segments }, { data: savedWords }] = await Promise.all([
    supabase
      .from("caption_segments")
      .select("id, start_ms, end_ms, body")
      .eq("text_id", textId)
      .order("segment_index", { ascending: true }),
    supabase
      .from("vocabulary_items")
      .select("id, headword, level, seen_count")
      .eq("owner_id", profile.id)
      .eq("language", text.language),
  ]);

  const wordLevels: Record<string, { id: string; level: number; seenCount: number }> = {};
  for (const w of savedWords ?? []) {
    wordLevels[w.headword.toLowerCase()] = { id: w.id, level: w.level, seenCount: w.seen_count };
  }

  return (
    <WatchPlayer
      textId={text.id}
      title={text.title}
      videoId={text.youtube_video_id}
      segments={(segments ?? []).map((s) => ({
        id: s.id,
        startMs: s.start_ms,
        endMs: s.end_ms,
        body: s.body,
      }))}
      sourceLang={text.language}
      targetLang={profile.native_language}
      wordLevels={wordLevels}
    />
  );
}
