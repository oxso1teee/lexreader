import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import ReviewSession, { type ReviewCard } from "./review-session";

export default async function ReviewPage() {
  const profile = await getProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("srs_state")
    .select(
      "vocabulary_item_id, due_at, vocabulary_items!inner(id, headword, translation, context_sentence, context_translation, status)",
    )
    .lte("due_at", new Date().toISOString())
    .in("vocabulary_items.status", ["new", "learning"])
    .order("due_at", { ascending: true })
    .limit(Math.max(profile!.daily_word_goal, 20));

  const cards: ReviewCard[] = (data ?? []).map((row) => {
    const item = row.vocabulary_items as unknown as {
      headword: string;
      translation: string;
      context_sentence: string | null;
      context_translation: string | null;
    };
    return {
      vocabularyItemId: row.vocabulary_item_id,
      headword: item.headword,
      translation: item.translation,
      contextSentence: item.context_sentence,
      contextTranslation: item.context_translation,
    };
  });

  return <ReviewSession cards={cards} />;
}
