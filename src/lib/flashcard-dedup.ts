// M3 Slice 4 §13: dedup for manual add / CSV / TSV / JSON import into
// flashcards. Normalized key = trimmed, lowercased `front`, scoped to
// owner+language — GLOBAL across all of a user's decks, not per-deck. This
// matches the existing precedent already in production for Reader-
// originated saves (saveVocabularyItem in ./vocabulary.ts, same
// .ilike(escapeIlike(...)) pattern against vocabulary_items.headword): "did
// I already save this word" means the same thing everywhere in the app,
// not just within one deck. Import-batch-internal dedup (two rows in the
// same CSV) already existed in import-cards.ts's validateCards() — this
// file only adds the check against what's already saved.
import { escapeIlike } from "./ilike.ts";
import type { SupabaseServerClient } from "./supabase/server.ts";

export function normalizeFront(front: string): string {
  return front.trim().toLowerCase();
}

export async function findDuplicateFlashcardId(
  supabase: SupabaseServerClient,
  ownerId: string,
  language: string,
  front: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("flashcards")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("language", language)
    .ilike("front", escapeIlike(normalizeFront(front)))
    .maybeSingle();
  return data?.id ?? null;
}
