import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSrsSettings } from "@/lib/srs-settings";
import type { ReviewCard } from "./review-session";
import ReviewModeSwitcher from "./review-mode-switcher";

export default async function DeckReviewPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getSrsSettings(supabase, profile.id);

  let query = supabase
    .from("srs_state")
    .select(
      "flashcard_id, due_at, flashcards!inner(id, front, back, notes, deck_id, owner_id)",
    )
    .eq("flashcards.owner_id", profile.id)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(Math.max(settings.max_reviews_per_day, 20));

  if (deckId !== "all") {
    query = query.eq("flashcards.deck_id", deckId);
  }

  const { data } = await query;

  const cards: ReviewCard[] = (data ?? []).map((row) => {
    const card = row.flashcards as unknown as { front: string; back: string; notes: string | null };
    return {
      flashcardId: row.flashcard_id,
      front: card.front,
      back: card.back,
      notes: card.notes,
    };
  });

  return <ReviewModeSwitcher cards={cards} />;
}
