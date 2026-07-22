import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { getSrsSettings } from "@/lib/srs-settings";
import type { ReviewCard } from "./review-session";
import ReviewModeSwitcher from "./review-mode-switcher";

const SELECT = "flashcard_id, due_at, repetitions, flashcards!inner(id, front, back, notes, deck_id, owner_id)";

interface SrsStateRow {
  flashcard_id: string;
  due_at: string;
  repetitions: number;
  flashcards: { front: string; back: string; notes: string | null } | { front: string; back: string; notes: string | null }[];
}

function toCards(rows: SrsStateRow[] | null): ReviewCard[] {
  return (rows ?? []).map((row) => {
    const card = row.flashcards as unknown as { front: string; back: string; notes: string | null };
    return {
      flashcardId: row.flashcard_id,
      front: card.front,
      back: card.back,
      notes: card.notes,
    };
  });
}

export default async function DeckReviewPage({
  params,
}: {
  params: Promise<{ deckId: string }>;
}) {
  const { deckId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();
  const settings = await getSrsSettings(supabase, profile.id);
  const now = new Date().toISOString();

  let reviewQuery = supabase
    .from("srs_state")
    .select(SELECT)
    .eq("flashcards.owner_id", profile.id)
    .gt("repetitions", 0)
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(settings.max_reviews_per_day);

  let newQuery = supabase
    .from("srs_state")
    .select(SELECT)
    .eq("flashcards.owner_id", profile.id)
    .eq("repetitions", 0)
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(settings.new_cards_per_day);

  if (deckId !== "all") {
    reviewQuery = reviewQuery.eq("flashcards.deck_id", deckId);
    newQuery = newQuery.eq("flashcards.deck_id", deckId);
  }

  const [{ data: reviewRows }, { data: newRows }] = await Promise.all([reviewQuery, newQuery]);

  // Сначала карточки на повторение (не дать очереди повторов утонуть в новых
  // карточках), затем новые — раздел 6.2 роадмапа: два независимых лимита.
  const cards: ReviewCard[] = [...toCards(reviewRows), ...toCards(newRows)];

  return <ReviewModeSwitcher cards={cards} />;
}
