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
