import type { SupabaseServerClient } from "@/lib/supabase/server";

export async function getDueCount(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<number> {
  const { count } = await supabase
    .from("srs_state")
    .select("flashcard_id, flashcards!inner(owner_id, language)", { count: "exact", head: true })
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .lte("due_at", new Date().toISOString());
  return count ?? 0;
}

// docs/IMPLEMENTATION_PROMPT_REDESIGN_2026-07-30.md, раздел 4.7: карточка
// колоды показывает кольцо прогресса (доля карточек колоды, ждущих
// повторения прямо сейчас), а не только общий счётчик карт.
export async function getDueCountsByDeck(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("srs_state")
    .select("flashcards!inner(owner_id, language, deck_id)")
    .eq("flashcards.owner_id", ownerId)
    .eq("flashcards.language", language)
    .lte("due_at", new Date().toISOString());

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const card = row.flashcards as unknown as { deck_id: string } | { deck_id: string }[] | null;
    const deckId = Array.isArray(card) ? card[0]?.deck_id : card?.deck_id;
    if (!deckId) continue;
    counts.set(deckId, (counts.get(deckId) ?? 0) + 1);
  }
  return counts;
}
